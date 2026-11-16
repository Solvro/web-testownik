package pl.solvro.testownik;

import android.app.Application;
import android.content.Context;
import android.content.ContextWrapper;
import android.database.DatabaseErrorHandler;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;
import com.reactnativecommunity.asyncstorage.AsyncStorageModule;
import com.reactnativecommunity.asyncstorage.ReactDatabaseSupplier;
import java.io.File;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.io.FileInputStream;
import java.security.MessageDigest;
import android.database.Cursor;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Installed AsyncStorage module probe; never launches an Activity or opens app storage. */
@RunWith(AndroidJUnit4.class)
public class StorageLimits {
    private static final int MIB = 1024 * 1024;

    private static final class IsolatedContext extends ContextWrapper {
        final File root;
        final AtomicInteger openFailuresRemaining = new AtomicInteger();
        final AtomicInteger failedOpenPaths = new AtomicInteger();
        final AtomicInteger deletedDatabases = new AtomicInteger();
        IsolatedContext(Context base, File root) {
            super(base);
            this.root = root;
        }
        @Override public Context getApplicationContext() { return this; }
        private File realDatabasePath(String name) {
            if (!new File(name).getName().equals(name)) throw new IllegalArgumentException("Unsafe probe database name");
            File directory = new File(root, "databases");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Cannot create probe database directory");
            return new File(directory, name);
        }
        @Override public File getDatabasePath(String name) {
            if ("RKStorage".equals(name) && openFailuresRemaining.getAndUpdate(value -> Math.max(0, value - 1)) > 0) {
                failedOpenPaths.incrementAndGet();
                File blocked = new File(root, "blocked-open-directory");
                if (!blocked.exists() && !blocked.mkdirs()) throw new IllegalStateException("Cannot create isolated failure path");
                return blocked; // A native CANTOPEN error: this path is a directory, never a user's DB.
            }
            return realDatabasePath(name);
        }
        @Override public SQLiteDatabase openOrCreateDatabase(String name, int mode, SQLiteDatabase.CursorFactory factory) {
            return openOrCreateDatabase(name, mode, factory, null);
        }
        @Override public SQLiteDatabase openOrCreateDatabase(String name, int mode, SQLiteDatabase.CursorFactory factory, DatabaseErrorHandler handler) {
            return SQLiteDatabase.openDatabase(getDatabasePath(name).getPath(), factory,
                SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.CREATE_IF_NECESSARY, handler);
        }
        @Override public boolean deleteDatabase(String name) {
            deletedDatabases.incrementAndGet();
            return SQLiteDatabase.deleteDatabase(realDatabasePath(name));
        }
        @Override public String[] databaseList() {
            String[] names = realDatabasePath("unused").getParentFile().list();
            return names == null ? new String[0] : names;
        }
        @Override public File getFilesDir() { return new File(root, "files"); }
        @Override public File getCacheDir() { return new File(root, "cache"); }
    }

    private interface Operation { void run(Callback callback); }
    private static Object[] invoke(Operation operation) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Object[]> result = new AtomicReference<>();
        AtomicInteger callbacks = new AtomicInteger();
        operation.run((Object... args) -> { callbacks.incrementAndGet(); result.set(args); completed.countDown(); });
        assertTrue("Installed module callback must finish", completed.await(20, TimeUnit.SECONDS));
        assertEquals("Module callback must run exactly once", 1, callbacks.get());
        return result.get();
    }
    private static WritableArray keys(String key) {
        WritableArray keys = Arguments.createArray(); keys.pushString(key); return keys;
    }
    private static Object[] write(AsyncStorageModule module, String key, String value) throws Exception {
        WritableArray pair = Arguments.createArray(); pair.pushString(key); pair.pushString(value);
        WritableArray pairs = Arguments.createArray(); pairs.pushArray(pair);
        return invoke((callback) -> module.multiSet(pairs, callback));
    }
    private static String repeated(int length) {
        char[] bytes = new char[length]; Arrays.fill(bytes, 'q'); return new String(bytes);
    }
    private static WritableArray pair(String key, String value) {
        WritableArray result = Arguments.createArray();
        result.pushString(key); result.pushString(value); return result;
    }
    private static Map<String, String> readRows(AsyncStorageModule module, WritableArray names) throws Exception {
        Object[] result = invoke((callback) -> module.multiGet(names, callback));
        assertNull("All bounded rows must be readable together", result[0]);
        ReadableArray rows = (ReadableArray) result[1];
        Map<String, String> values = new HashMap<>();
        for (int index = 0; index < rows.size(); index++) {
            ReadableArray row = rows.getArray(index);
            assertFalse("multiGet must not duplicate result rows", values.containsKey(row.getString(0)));
            values.put(row.getString(0), row.isNull(1) ? null : row.getString(1));
        }
        return values;
    }
    private static void assertSuccessfulWrite(Object[] result) {
        assertTrue("Expected module multiSet success", result.length == 0 || result[0] == null);
    }
    private static void report(String key, String value) {
        Bundle status = new Bundle(); status.putString("stream", "\nSTORAGE_PROBE " + key + "=" + value + "\n");
        InstrumentationRegistry.getInstrumentation().sendStatus(0, status);
    }
    private static void deleteProbe(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteProbe(child);
        if (file.exists() && !file.delete()) throw new IllegalStateException("Could not clean isolated probe file");
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format("%02x", value & 255));
        return result.toString();
    }
    private static String rawDigest(SQLiteDatabase database, String key) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        int size;
        try (Cursor cursor = database.rawQuery("SELECT length(CAST(value AS BLOB)) FROM catalystLocalStorage WHERE key=?", new String[]{key})) {
            assertTrue(cursor.moveToFirst()); size = cursor.getInt(0);
        }
        for (int offset = 0; offset < size; offset += MIB / 2) {
            try (Cursor cursor = database.rawQuery("SELECT substr(CAST(value AS BLOB),?,?) FROM catalystLocalStorage WHERE key=?",
                    new String[]{Integer.toString(offset + 1), Integer.toString(Math.min(MIB / 2, size - offset)), key})) {
                assertTrue(cursor.moveToFirst()); digest.update(cursor.getBlob(0));
            }
        }
        return hex(digest.digest());
    }
    private static Map<String, String> databaseFiles(SQLiteDatabase database) throws Exception {
        Map<String, String> result = new HashMap<>();
        for (String suffix : new String[]{"", "-journal", "-wal"}) {
            File file = new File(database.getPath() + suffix);
            if (!file.exists()) continue;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) >= 0) digest.update(buffer, 0, count);
            }
            result.put(suffix, file.length() + ":" + hex(digest.digest()));
        }
        return result;
    }
    private static void legacyReadProof(AsyncStorageModule installed, SQLiteDatabase database) throws Exception {
        assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
        String unicode = repeated(MIB / 2 - 1) + "🦊" + repeated(MIB / 2 - 4) + "漢" + repeated(2 * MIB);
        String key = "testownik.v1.offline.legacy-probe";
        assertSuccessfulWrite(write(installed, key, unicode));
        assertSuccessfulWrite(write(installed, "empty", ""));
        String rawBefore = rawDigest(database, key);
        Map<String, String> before = databaseFiles(database);
        WritableArray names = keys(key); names.pushString("empty"); names.pushString("missing"); names.pushString(key);
        Map<String, String> recovered = readRows(installed, names);
        assertEquals(3, recovered.size()); assertEquals(unicode, recovered.get(key));
        assertEquals("", recovered.get("empty")); assertNull(recovered.get("missing"));
        assertFalse(database.inTransaction());
        assertEquals(rawBefore, rawDigest(database, key));
        assertEquals("Legacy read must not change database/journal bytes", before, databaseFiles(database));
        report("legacyUnicode", "fallback=success boundariesPreserved rawBytesAndFilesUnchanged");

        // A large row in a later SQL batch must discard prior partial results.
        WritableArray pairs = Arguments.createArray(), many = Arguments.createArray();
        for (int index = 0; index < 999; index++) {
            String name = "small-" + index; pairs.pushArray(pair(name, "small")); many.pushString(name);
        }
        assertSuccessfulWrite(invoke((callback) -> installed.multiSet(pairs, callback)));
        many.pushString(key); many.pushString("missing"); many.pushString("small-0");
        Map<String, String> batch = readRows(installed, many);
        assertEquals(1001, batch.size()); assertEquals(unicode, batch.get(key)); assertEquals("small", batch.get("small-0"));
        assertNull(batch.get("missing")); report("legacy999Batch", "rebuiltWholeResult noDuplicates missingPreserved");

        // NUL is inserted through SQL to avoid making bridge input truncation part of the setup.
        byte[] nul = new byte[3 * MIB]; Arrays.fill(nul, (byte) 'q'); nul[MIB] = 0;
        database.execSQL("INSERT INTO catalystLocalStorage VALUES (?,CAST(? AS TEXT))", new Object[]{"nul", nul});
        String nulBefore = rawDigest(database, "nul"), nulFull = new String(nul, StandardCharsets.UTF_8);
        Object[] nulRead = invoke((callback) -> installed.multiGet(keys("nul"), callback));
        assertNull(nulRead[0]);
        // NativeArray.toString serializes the retained C++ string as escaped JSON;
        // Java getString imports through fbjni c_str() and can truncate only that view.
        assertEquals("Native result must retain every NUL and following byte", nulFull,
            new org.json.JSONArray(nulRead[1].toString()).getJSONArray(0).getString(1));
        String nulValue = ((ReadableArray) nulRead[1]).getArray(0).getString(1);
        assertTrue("NUL bridge representation must be measured explicitly", nulValue.equals(nulFull) || nulValue.equals(nulFull.substring(0, MIB)));
        assertEquals(nulBefore, rawDigest(database, "nul"));
        report("legacyNul", (nulValue.length() == nulFull.length() ? "javaViewPreserved" : "javaViewTruncated") + " nativeJsonAndRawPreserved");

        assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
        String atLimit = repeated(8 * MIB);
        assertSuccessfulWrite(write(installed, "at-limit", atLimit));
        assertEquals(atLimit, readRows(installed, keys("at-limit")).get("at-limit"));
        assertSuccessfulWrite(write(installed, "over-limit", atLimit + "x"));
        String oversizedBefore = rawDigest(database, "over-limit");
        Object[] tooLarge = invoke((callback) -> installed.multiGet(keys("over-limit"), callback));
        assertNotNull(tooLarge[0]); assertNull(tooLarge[1]); assertEquals(oversizedBefore, rawDigest(database, "over-limit"));
        assertSuccessfulWrite(invoke((callback) -> installed.multiRemove(keys("over-limit"), callback)));
        assertSuccessfulWrite(write(installed, "second-limit", atLimit));
        assertSuccessfulWrite(write(installed, "one-byte", "x"));
        WritableArray aggregate = keys("at-limit"); aggregate.pushString("second-limit"); aggregate.pushString("one-byte");
        Object[] tooMany = invoke((callback) -> installed.multiGet(aggregate, callback));
        assertNotNull(tooMany[0]); assertNull(tooMany[1]); assertFalse(database.inTransaction());
        report("legacyBounds", "8MiBSuccess valuePlusOneAnd16MiBAggregatePlusOneRejected rawKept");

        assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
        byte[] invalid = new byte[3 * MIB]; Arrays.fill(invalid, (byte) 'q'); invalid[0] = (byte) 0xc3; invalid[1] = 0x28;
        database.execSQL("INSERT INTO catalystLocalStorage VALUES (?,CAST(? AS TEXT))", new Object[]{"invalid-utf8", invalid});
        String invalidBefore = rawDigest(database, "invalid-utf8");
        Object[] invalidRead = invoke((callback) -> installed.multiGet(keys("invalid-utf8"), callback));
        assertNotNull(invalidRead[0]); assertNull(invalidRead[1]); assertEquals(invalidBefore, rawDigest(database, "invalid-utf8"));
        assertFalse(database.inTransaction()); report("legacyInvalidUtf8", "errorCallback rawUnchanged");

        assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
        String legacy = "{\"quizzes\":{},\"queue\":[{\"request_id\":\"retained-answer\"}],\"errors\":{\"quiz\":\"retained-conflict\"},\"padding\":\"" + repeated(3 * MIB) + "\"}";
        assertSuccessfulWrite(write(installed, key, legacy));
        String legacyBefore = rawDigest(database, key);
        WritableArray migration = Arguments.createArray(), chunks = Arguments.createArray();
        int count = 0;
        for (int offset = 0; offset < legacy.length(); offset += MIB / 2) {
            String name = "testownik.chunks.v1/testownik.v1.offline.legacy-probe:" + count++;
            chunks.pushString(name); migration.pushArray(pair(name, legacy.substring(offset, Math.min(legacy.length(), offset + MIB / 2))));
        }
        String header = "#testownik-chunked-v1#{\"count\":" + count + ",\"length\":" + legacy.length() + ",\"bytes\":" + legacy.getBytes(StandardCharsets.UTF_8).length + ",\"sha256\":\"" + legacyBefore + "\"}";
        migration.pushArray(pair(key, header));
        WritableArray failing = Arguments.createArray();
        for (int index = 0; index < migration.size(); index++) {
            ReadableArray value = migration.getArray(index);
            failing.pushArray(pair(value.getString(0), value.getString(1)));
        }
        WritableArray wrong = Arguments.createArray(); wrong.pushString("invalid-migration"); wrong.pushInt(42); failing.pushArray(wrong);
        Object[] failure = invoke((callback) -> installed.multiSet(failing, callback)); assertNotNull(failure[0]);
        assertEquals(legacyBefore, rawDigest(database, key)); assertEquals(legacy, readRows(installed, keys(key)).get(key));
        for (String value : readRows(installed, chunks).values()) assertNull(value);
        assertSuccessfulWrite(invoke((callback) -> installed.multiSet(migration, callback)));
        assertEquals(header, readRows(installed, keys(key)).get(key));
        Map<String, String> parts = readRows(installed, chunks); StringBuilder joined = new StringBuilder();
        for (int index = 0; index < chunks.size(); index++) joined.append(parts.get(chunks.getString(index)));
        assertEquals(legacy, joined.toString()); report("legacyMigration", "transactionalHeaderAndSlots exactQueueAndErrorPreserved failureRollsBack");
    }

    private static void concurrencyProof(AsyncStorageModule installed, ReactDatabaseSupplier supplier,
            BridgeReactContext react, Field singleton, Field moduleSupplier) throws Exception {
        assertNull("Only the already verified isolated supplier may be shared", singleton.get(null));
        AsyncStorageModule second;
        singleton.set(null, supplier);
        try {
            second = new AsyncStorageModule(react);
            assertSame("Both isolated module instances must share the verified supplier", supplier, moduleSupplier.get(second));
        } finally {
            if (singleton.get(null) == supplier) singleton.set(null, null);
        }
        try {
            assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
            String before = repeated(3 * MIB), after = before.replace('q', 'r');
            assertSuccessfulWrite(write(installed, "race", before));
            for (int attempt = 0; attempt < 8; attempt++) {
                final String next = attempt % 2 == 0 ? after : before;
                CountDownLatch both = new CountDownLatch(2);
                AtomicInteger reads = new AtomicInteger(), writes = new AtomicInteger();
                AtomicReference<Object[]> read = new AtomicReference<>(), written = new AtomicReference<>();
                installed.multiGet(keys("race"), (Object... args) -> { reads.incrementAndGet(); read.set(args); both.countDown(); });
                WritableArray change = Arguments.createArray(); change.pushArray(pair("race", next));
                second.multiSet(change, (Object... args) -> { writes.incrementAndGet(); written.set(args); both.countDown(); });
                assertTrue("Parallel isolated instances must finish without deadlock", both.await(20, TimeUnit.SECONDS));
                assertEquals(1, reads.get()); assertEquals(1, writes.get()); assertSuccessfulWrite(written.get());
                assertNull(read.get()[0]);
                String value = ((ReadableArray) read.get()[1]).getArray(0).getString(1);
                assertTrue("A snapshot must never mix old/new slices", value.equals(before) || value.equals(after));
            }
            report("legacyParallelModules", "8ScheduledReadWrites wholeSnapshot callbacksOnce noDeadlock");

            assertSuccessfulWrite(write(installed, "race", before));
            CountDownLatch ordered = new CountDownLatch(3);
            AtomicReference<Object[]> first = new AtomicReference<>(), middle = new AtomicReference<>(), last = new AtomicReference<>();
            installed.multiGet(keys("race"), (Object... args) -> { first.set(args); ordered.countDown(); });
            WritableArray change = Arguments.createArray(); change.pushArray(pair("race", after));
            installed.multiSet(change, (Object... args) -> { middle.set(args); ordered.countDown(); });
            installed.multiGet(keys("race"), (Object... args) -> { last.set(args); ordered.countDown(); });
            assertTrue(ordered.await(20, TimeUnit.SECONDS)); assertNull(first.get()[0]); assertSuccessfulWrite(middle.get()); assertNull(last.get()[0]);
            assertEquals(before, ((ReadableArray) first.get()[1]).getArray(0).getString(1));
            assertEquals(after, ((ReadableArray) last.get()[1]).getArray(0).getString(1));
            report("legacyQueueOrder", "readOld writeNew readNew");

            String preserved = rawDigest(supplier.get(), "race");
            CountDownLatch finished = new CountDownLatch(1);
            AtomicInteger callbacks = new AtomicInteger(); AtomicReference<Object[]> result = new AtomicReference<>();
            installed.multiGet(keys("race"), (Object... args) -> { callbacks.incrementAndGet(); result.set(args); finished.countDown(); });
            // Existing-module lifecycle race only; no test-only production hooks.
            second.invalidate();
            assertTrue("Read overlapping invalidation must complete or report an error", finished.await(20, TimeUnit.SECONDS));
            assertEquals(1, callbacks.get());
            if (result.get()[0] == null) assertEquals(after, ((ReadableArray) result.get()[1]).getArray(0).getString(1));
            else assertNull(result.get()[1]);
            assertEquals(after, readRows(installed, keys("race")).get("race"));
            assertEquals(preserved, rawDigest(supplier.get(), "race"));
            report("legacyInvalidateNearRead", "completeOrErrorOnce nextOpenReadsSameRawData");
        } finally {
            second.invalidate();
        }
    }

    private interface IsolatedProof {
        void run(AsyncStorageModule module, ReactDatabaseSupplier supplier, IsolatedContext context) throws Exception;
    }
    private static String fileDigest(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[65536]; int count;
            while ((count = input.read(bytes)) >= 0) digest.update(bytes, 0, count);
        }
        return hex(digest.digest());
    }
    private static void withPreservationFixture(IsolatedProof proof) throws Exception {
        assumeTrue("Explicit opt-in required", "true".equals(InstrumentationRegistry.getArguments().getString("isolatedStorageProbe")));
        assertEquals(StorageLimits.class.getName(), InstrumentationRegistry.getArguments().getString("class"));
        assertSame(StorageLimitsRunner.class, InstrumentationRegistry.getInstrumentation().getClass());
        Field singleton = ReactDatabaseSupplier.class.getDeclaredField("sReactDatabaseSupplierInstance");
        Field moduleSupplier = AsyncStorageModule.class.getDeclaredField("mReactDatabaseSupplier");
        Field supplierContext = ReactDatabaseSupplier.class.getDeclaredField("mContext");
        singleton.setAccessible(true); moduleSupplier.setAccessible(true); supplierContext.setAccessible(true);
        assertNull("Never replace an existing supplier", singleton.get(null));
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Context test = InstrumentationRegistry.getInstrumentation().getContext();
        assertTrue("Preservation probes require the separate QA package", target.getPackageName().endsWith(".storageqa"));
        assertSame(Application.class, target.getApplicationContext().getClass());
        assertNotEquals(target.getPackageName(), test.getPackageName());
        File root = new File(target.getCacheDir(), "storage-preservation-" + UUID.randomUUID());
        IsolatedContext isolated = new IsolatedContext(test, root);
        SoLoader.init(target.getApplicationContext(), OpenSourceMergedSoMapping.INSTANCE);
        BridgeReactContext react = new BridgeReactContext(isolated);
        assertSame(isolated, react.getApplicationContext());
        AsyncStorageModule module = null; ReactDatabaseSupplier supplier = null; boolean succeeded = false;
        try {
            assertNull("Supplier appeared before construction", singleton.get(null));
            module = new AsyncStorageModule(react);
            supplier = (ReactDatabaseSupplier) moduleSupplier.get(module);
            assertSame(isolated, supplierContext.get(supplier));
            if (singleton.get(null) == supplier) singleton.set(null, null);
            String path = supplier.get().getPath();
            assertEquals(isolated.realDatabasePath("RKStorage").getCanonicalPath(), new File(path).getCanonicalPath());
            assertTrue(new File(path).getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator));
            assertNotEquals(target.getDatabasePath("RKStorage").getCanonicalPath(), new File(path).getCanonicalPath());
            proof.run(module, supplier, isolated);
            succeeded = true;
        } finally {
            Object owned = supplier != null ? supplier : singleton.get(null);
            if (owned != null && supplierContext.get(owned) == isolated) {
                if (module != null) module.invalidate(); else ((ReactDatabaseSupplier) owned).closeDatabase();
                if (singleton.get(null) == owned) singleton.set(null, null);
                try { deleteProbe(root); report("preservationCleanup", "success"); }
                catch (RuntimeException cleanup) {
                    report("preservationCleanup", cleanup.toString());
                    if (succeeded) throw cleanup;
                }
            }
        }
    }

    @Test public void installedModuleOpenFailurePreservation() throws Exception {
        withPreservationFixture((module, supplier, context) -> {
            String seed = "{\"queue\":[{\"request_id\":\"must-keep\"}],\"errors\":{\"quiz\":\"keep-conflict\"}}";
            assertSuccessfulWrite(write(module, "preserved", seed));
            File file = context.realDatabasePath("RKStorage");
            supplier.closeDatabase(); String before = fileDigest(file);
            context.openFailuresRemaining.set(1);
            Map<String, String> recovered = readRows(module, keys("preserved"));
            report("transientOpenBeforeAssertion", "deleted=" + context.deletedDatabases.get() + " retained=" + seed.equals(recovered.get("preserved")));
            assertEquals("A transient failed open must never delete saved answers", 0, context.deletedDatabases.get());
            assertEquals(seed, recovered.get("preserved"));
            assertEquals(1, context.failedOpenPaths.get());
            supplier.closeDatabase(); assertEquals(before, fileDigest(file));
            report("transientOpen", "nativeCantOpen retryRetainsExactRowAndBytes noDelete");

            // Exhausted open on both read and non-read APIs must settle exactly once.
            Operation[] operations = new Operation[]{
                callback -> module.multiGet(keys("preserved"), callback),
                callback -> module.getAllKeys(callback),
                callback -> module.multiSet(Arguments.makeNativeArray(java.util.Collections.singletonList(java.util.Arrays.asList("new", "value"))), callback),
                callback -> module.multiRemove(keys("preserved"), callback),
                callback -> module.multiMerge(Arguments.makeNativeArray(java.util.Collections.singletonList(java.util.Arrays.asList("preserved", "{}"))), callback),
                callback -> module.clear(callback)
            };
            for (Operation operation : operations) {
                supplier.closeDatabase(); int failures = context.failedOpenPaths.get();
                context.openFailuresRemaining.set(2);
                Object[] result = invoke(operation);
                assertNotNull("Exhausted open must report an error", result[0]);
                if (result.length > 1) assertNull("No partial result on failed open", result[1]);
                assertEquals("Exactly two native open attempts", failures + 2, context.failedOpenPaths.get());
                assertEquals(0, context.deletedDatabases.get()); assertTrue(file.exists()); assertEquals(before, fileDigest(file));
                context.openFailuresRemaining.set(0);
                assertEquals(seed, readRows(module, keys("preserved")).get("preserved"));
            }
            report("persistentOpen", "all6Operations errorCallback noDelete exactBytes laterRetrySuccess");

            // A supplier retaining a handle closed by another module must keep the original error.
            supplier.get().close(); context.openFailuresRemaining.set(2);
            try { supplier.get(); fail("Exhausted reopen must throw"); }
            catch (android.database.sqlite.SQLiteCantOpenDatabaseException expected) { /* native error retained */ }
            context.openFailuresRemaining.set(0);
            assertEquals(seed, readRows(module, keys("preserved")).get("preserved"));
            assertEquals(0, context.deletedDatabases.get());
            report("staleHandle", "nativeCantOpen retained laterRetrySuccess");

            // Existing explicit native clear remains available; only own UUID fixture is erased.
            supplier.closeDatabase(); context.openFailuresRemaining.set(2);
            supplier.clearAndCloseDatabase(); context.openFailuresRemaining.set(0);
            assertEquals(1, context.deletedDatabases.get());
            assertNull(readRows(module, keys("preserved")).get("preserved"));
            report("explicitClear", "onlyRequestedUuidFixtureDeleted");
        });
    }

    @Test public void installedModuleCorruptionPreservation() throws Exception {
        withPreservationFixture((module, supplier, context) -> {
            assertSuccessfulWrite(write(module, "preserved", "saved answer and conflict"));
            File file = context.realDatabasePath("RKStorage");
            supplier.closeDatabase();
            // Deliberately corrupt ONLY this seeded UUID fixture, never any app/user database.
            try (java.io.RandomAccessFile fixture = new java.io.RandomAccessFile(file, "rw")) {
                fixture.seek(0); fixture.write("QA broken header!".getBytes(StandardCharsets.UTF_8));
            }
            String before = fileDigest(file);
            Object[] result = invoke(callback -> module.multiGet(keys("preserved"), callback));
            report("corruptOpenBeforeAssertion", "error=" + (result[0] != null) + " rawRetained=" + (file.exists() && before.equals(fileDigest(file))));
            assertNotNull("Corruption must report an error, never create an empty replacement", result[0]);
            assertNull(result[1]); assertTrue(file.exists()); assertEquals(before, fileDigest(file));
            assertEquals(0, context.deletedDatabases.get());
            // A second open remains an error and cannot make the saved fixture disappear.
            Object[] second = invoke(callback -> module.multiGet(keys("preserved"), callback));
            assertNotNull(second[0]); assertNull(second[1]); assertEquals(before, fileDigest(file));
            report("corruptOpen", "errorCallback rawFilePreserved stillUnusable noRepairClaim");
            supplier.clearAndCloseDatabase();
            assertEquals(1, context.deletedDatabases.get());
            assertNull(readRows(module, keys("preserved")).get("preserved"));
            report("corruptExplicitClear", "onlyRequestedUuidFixtureDeleted");
        });
    }

    @Test public void installedModuleLargeValueRead() throws Exception {
        assumeTrue("Explicit opt-in; no Activities or production storage may be used",
            "true".equals(InstrumentationRegistry.getArguments().getString("isolatedStorageProbe")));
        assertEquals("Run this probe alone in a fresh instrumentation process",
            StorageLimits.class.getName(), InstrumentationRegistry.getArguments().getString("class"));
        Field singleton = ReactDatabaseSupplier.class.getDeclaredField("sReactDatabaseSupplierInstance");
        Field moduleSupplier = AsyncStorageModule.class.getDeclaredField("mReactDatabaseSupplier");
        Field supplierContext = ReactDatabaseSupplier.class.getDeclaredField("mContext");
        singleton.setAccessible(true);
        moduleSupplier.setAccessible(true);
        supplierContext.setAccessible(true);
        // Never reset, close, or use an existing production supplier.
        assumeTrue("AsyncStorage already initialized; isolation cannot be guaranteed", singleton.get(null) == null);
        Context testContext = InstrumentationRegistry.getInstrumentation().getContext();
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertSame("Probe requires the separate runner", StorageLimitsRunner.class,
            InstrumentationRegistry.getInstrumentation().getClass());
        assertSame("Production Application and React host must not exist", Application.class,
            target.getApplicationContext().getClass());
        assertNotEquals("Probe must originate in the test APK", target.getPackageName(), testContext.getPackageName());
        File root = new File(target.getCacheDir(), "storage-limits-" + UUID.randomUUID());
        // Only JNI library loading is initialized. No MainApplication, Expo
        // lifecycle dispatcher, React host, Activity, or app JavaScript runs.
        SoLoader.init(target.getApplicationContext(), OpenSourceMergedSoMapping.INSTANCE);
        IsolatedContext isolated = new IsolatedContext(testContext, root);
        BridgeReactContext react = new BridgeReactContext(isolated);
        assertSame(isolated, react.getApplicationContext());
        AsyncStorageModule module = null;
        ReactDatabaseSupplier supplier = null;
        try {
            // Recheck directly before constructing the module: no running React host is allowed.
            assumeTrue("Supplier appeared before construction", singleton.get(null) == null);
            module = new AsyncStorageModule(react);
            supplier = (ReactDatabaseSupplier) moduleSupplier.get(module);
            assertSame("Supplier must use the redirected context", isolated, supplierContext.get(supplier));
            assertSame(Application.class, target.getApplicationContext().getClass());
            // The module retains its own supplier. Remove only our supplier from
            // the process-global slot before any I/O so another module cannot
            // adopt it during the size measurements.
            if (singleton.get(null) == supplier) singleton.set(null, null);
            assertEquals(isolated.getDatabasePath("RKStorage").getCanonicalPath(), new File(supplier.get().getPath()).getCanonicalPath());
            assertTrue(new File(supplier.get().getPath()).getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator));
            assertNotEquals(target.getDatabasePath("RKStorage").getCanonicalPath(), new File(supplier.get().getPath()).getCanonicalPath());
            report("database", "isolated-UUID-QA-cache");
            report("maxBytes", Long.toString(supplier.get().getMaximumSize()));
            assertEquals("Fresh APK must include the configured 50 MiB capacity", 50L * MIB, supplier.get().getMaximumSize());
            Class.forName("com.reactnativecommunity.asyncstorage.LargeValueReader");
            // Only this asserted UUID database is temporarily capped for the old-size baseline.
            supplier.setMaximumSize(6L * MIB);
            report("isolatedBaselineMaxBytes", Long.toString(supplier.get().getMaximumSize()));
            final AsyncStorageModule installed = module;
            String one = repeated(MIB);
            assertSuccessfulWrite(write(installed, "small", one));
            Object[] small = invoke((callback) -> installed.multiGet(keys("small"), callback));
            assertNull(small[0]);
            assertEquals(one, ((ReadableArray) small[1]).getArray(0).getString(1));
            report("1MiB", "write=success read=success");
            assertSuccessfulWrite(invoke((callback) -> installed.multiRemove(keys("small"), callback)));
            String large = repeated(3 * MIB);
            assertSuccessfulWrite(write(installed, "large", large));
            Object[] largeRead = invoke((callback) -> installed.multiGet(keys("large"), callback));
            report("3MiB", "write=success read=" + (largeRead[0] == null ? "success" : largeRead[0].toString()));
            assertNull("Patched installed module must recover the legacy oversized row", largeRead[0]);
            assertEquals(large, ((ReadableArray) largeRead[1]).getArray(0).getString(1));
            assertSuccessfulWrite(invoke((callback) -> installed.multiRemove(keys("large"), callback)));
            for (int part = 0; part < 3; part++) assertSuccessfulWrite(write(installed, "part-" + part, one));
            for (int part = 0; part < 3; part++) {
                final String key = "part-" + part;
                Object[] read = invoke((callback) -> installed.multiGet(keys(key), callback));
                assertNull(read[0]);
                assertEquals(one, ((ReadableArray) read[1]).getArray(0).getString(1));
            }
            report("3x1MiB", "write=success read=success");
            assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
            Object[] overLimit = write(installed, "over-limit", repeated(7 * MIB));
            assertTrue("A 7 MiB value must exceed the isolated 6 MiB baseline",
                overLimit.length > 0 && overLimit[0] != null);
            report("7MiB", "write=" + overLimit[0].toString());
            assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
            // Fixed slots must let a near-full logical value shrink/overwrite
            // without needing room for a second complete generation.
            WritableArray fixedNames = keys("fixed-header");
            WritableArray first = Arguments.createArray();
            first.pushArray(pair("fixed-header", "before"));
            for (int index = 0; index < 9; index++) {
                String name = "fixed-" + index; fixedNames.pushString(name);
                first.pushArray(pair(name, repeated(MIB / 2)));
            }
            assertSuccessfulWrite(invoke((callback) -> installed.multiSet(first, callback)));
            WritableArray overwrite = Arguments.createArray();
            overwrite.pushArray(pair("fixed-header", "after"));
            String changed = repeated(MIB / 2 - 1) + "z";
            for (int index = 0; index < 9; index++) overwrite.pushArray(pair("fixed-" + index, changed));
            assertSuccessfulWrite(invoke((callback) -> installed.multiSet(overwrite, callback)));
            Map<String, String> committed = readRows(installed, fixedNames);
            assertEquals("after", committed.get("fixed-header"));
            for (int index = 0; index < 9; index++) assertEquals(changed, committed.get("fixed-" + index));
            report("fixedSlots4.5MiB", "overwrite=success atDefault6MiB");
            WritableArray malformed = Arguments.createArray();
            malformed.pushArray(pair("fixed-header", "must-roll-back"));
            malformed.pushArray(pair("fixed-0", "must-roll-back"));
            // A null pair makes upstream return without its callback; an integer
            // instead throws into the callback error path and tests rollback.
            WritableArray invalid = Arguments.createArray();
            invalid.pushString("invalid-final-pair"); invalid.pushInt(42);
            malformed.pushArray(invalid);
            Object[] rejected = invoke((callback) -> installed.multiSet(malformed, callback));
            assertTrue(rejected.length > 0 && rejected[0] != null);
            assertEquals(committed, readRows(installed, fixedNames));
            assertNull(readRows(installed, keys("invalid-final-pair")).get("invalid-final-pair"));
            report("malformedFinalPair", "rollback=success headerAndSlotsUnchanged");
            WritableArray shrink = Arguments.createArray();
            shrink.pushArray(pair("fixed-header", "shrunk")); shrink.pushArray(pair("fixed-0", "retained answer"));
            assertSuccessfulWrite(invoke((callback) -> installed.multiSet(shrink, callback)));
            WritableArray high = Arguments.createArray();
            for (int index = 1; index < 9; index++) high.pushString("fixed-" + index);
            assertSuccessfulWrite(invoke((callback) -> installed.multiRemove(high, callback)));
            Map<String, String> shrunk = readRows(installed, fixedNames);
            assertEquals("shrunk", shrunk.get("fixed-header")); assertEquals("retained answer", shrunk.get("fixed-0"));
            for (int index = 1; index < 9; index++) assertNull(shrunk.get("fixed-" + index));
            report("fixedSlotsShrink", "commitAndCleanup=success");
            assertSuccessfulWrite(invoke((callback) -> installed.clear(callback)));
            // This override affects ONLY the already asserted UUID database.
            // Build capacity was asserted above; this restores the isolated stress limit.
            supplier.setMaximumSize(50L * MIB);
            report("isolatedStressMaxBytes", Long.toString(supplier.get().getMaximumSize()));
            String unit = "漢🦊";
            String unicode = new String(new char[(MIB / 2) / 7]).replace("\0", unit);
            assertTrue(unicode.getBytes(StandardCharsets.UTF_8).length <= MIB / 2);
            WritableArray unicodePairs = Arguments.createArray(), unicodeNames = Arguments.createArray();
            for (int index = 0; index < 16; index++) {
                String name = "unicode-" + index;
                unicodePairs.pushArray(pair(name, unicode)); unicodeNames.pushString(name);
            }
            assertSuccessfulWrite(invoke((callback) -> installed.multiSet(unicodePairs, callback)));
            Map<String, String> unicodeRead = readRows(installed, unicodeNames);
            for (int index = 0; index < 16; index++) assertEquals(unicode, unicodeRead.get("unicode-" + index));
            report("16x512KiBUnicode", "oneMultiGet=success threeByteAndAstralPreserved");
            legacyReadProof(installed, supplier.get());
            concurrencyProof(installed, supplier, react, singleton, moduleSupplier);
            assertSame(Application.class, target.getApplicationContext().getClass());
        } finally {
            Object owned = supplier != null ? supplier : singleton.get(null);
            // Never close or reset a supplier owned by the real application.
            if (owned != null && supplierContext.get(owned) == isolated) {
                if (module != null) module.invalidate();
                else ((ReactDatabaseSupplier) owned).closeDatabase();
                if (singleton.get(null) == owned) singleton.set(null, null);
                try { deleteProbe(root); report("cleanup", "success"); }
                catch (RuntimeException cleanup) { report("cleanup", cleanup.toString()); }
            }
        }
    }
}
