package pl.solvro.testownik;

import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Current embedded-JS QA only. Never runs against the user's installed package. */
@RunWith(AndroidJUnit4.class)
public class NativeQaFlows {
    private static final String PACKAGE = "pl.solvro.testownik.nativeqa";
    private UiDevice device;
    private String keyboardSetting;

    private UiObject2 label(String english, String polish) {
        Pattern text = Pattern.compile(Pattern.quote(english) + "|" + Pattern.quote(polish), Pattern.CASE_INSENSITIVE);
        UiObject2 result = device.wait(Until.findObject(By.text(text)), 15000);
        if (result == null) result = device.wait(Until.findObject(By.desc(text)), 1000);
        assertNotNull("Missing QA control: " + english, result);
        return result;
    }

    @Before public void launchSyntheticAccountOnly() throws Exception {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("disposableFixture"));
        assertEquals("true", InstrumentationRegistry.getArguments().getString("syntheticOAuth"));
        assertEquals(PACKAGE, InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        Class<?> config = Class.forName("pl.solvro.testownik.BuildConfig");
        assertEquals("http://127.0.0.1:8768/api", config.getField("NATIVE_QA_API").get(null));
        assertEquals("http://127.0.0.1:8769", config.getField("NATIVE_QA_WEB").get(null));
        assertEquals(false, config.getField("DEBUG").get(null));
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        // A browser callback must not launch an existing account in the base app.
        String handlers = device.executeShellCommand("cmd package query-activities --brief --components -a android.intent.action.VIEW -d testownik://auth");
        boolean ownsCallback = false;
        for (String handler : handlers.split("\\r?\\n")) {
            handler = handler.trim();
            if (handler.isEmpty()) continue;
            assertTrue("Every enabled callback handler must belong to isolated QA: " + handler,
                handler.startsWith(PACKAGE + "/"));
            ownsCallback = true;
        }
        assertTrue("The isolated QA app must own its callback", ownsCallback);
        keyboardSetting = device.executeShellCommand("settings get secure show_ime_with_hard_keyboard").trim();
        device.executeShellCommand("settings put secure show_ime_with_hard_keyboard 1");
        Intent launch = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager().getLaunchIntentForPackage(PACKAGE);
        assertNotNull(launch);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(launch);
        UiObject2 signIn = device.wait(Until.findObject(By.text(Pattern.compile("Sign in to Testownik|Zaloguj się do Testownika"))), 8000);
        if (signIn != null) signIn.click();
        label("Profile", "Profil");
        // Explicit package targeting also avoids offscreen Profile rows.
        Intent account = new Intent(Intent.ACTION_VIEW, Uri.parse("testownik://account"));
        account.setPackage(PACKAGE);
        account.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(account);
        UiObject2 identity = device.wait(Until.findObject(By.text("Disposable Native QA")), 20000);
        assertNotNull("Refusing tests outside the disposable OAuth principal", identity);
        assertNotNull("Refusing tests outside the synthetic email identity",
            device.wait(Until.findObject(By.text("native-qa@example.invalid")), 5000));
        device.pressBack();
    }

    @After public void captureAndRestoreKeyboard() throws Exception {
        if (device == null) return;
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "native-qa");
        directory.mkdirs();
        String stamp = Long.toString(System.currentTimeMillis());
        device.takeScreenshot(new File(directory, stamp + ".png"));
        device.dumpWindowHierarchy(new File(directory, stamp + ".xml"));
        if ("0".equals(keyboardSetting) || "1".equals(keyboardSetting))
            device.executeShellCommand("settings put secure show_ime_with_hard_keyboard " + keyboardSetting);
        else if ("null".equals(keyboardSetting)) device.executeShellCommand("settings delete secure show_ime_with_hard_keyboard");
    }

    @Test public void syntheticOAuthAndNativeNavigation() throws Exception {
        label("Library", "Biblioteka").click();
        label("Study", "Nauka");
        label("Grades", "Oceny");
        label("Profile", "Profil");
        assertFalse(device.hasObject(By.text(Pattern.compile("Couldn’t Sign In|Nie udało się zalogować"))));
    }

    @Test public void feedbackOpensKeyboardWithoutSending() throws Exception {
        // Explicit package targeting prevents the base app's scheme handler.
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("testownik://feedback"));
        intent.setPackage(PACKAGE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        UiObject2 subject = label("Subject", "Temat");
        subject.click();
        UiObject2 input = device.wait(Until.findObject(By.clazz("android.widget.EditText").focused(true)), 5000);
        assertNotNull("Feedback subject must expose its focused native input", input);
        input.setText("Synthetic keyboard draft");
        assertEquals("Synthetic keyboard draft", input.getText());
        String inputState = device.executeShellCommand("dumpsys input_method");
        assertTrue("Software keyboard must actually be shown", inputState.contains("mInputShown=true") || inputState.contains("isInputViewShown=true"));
        // No delivery request is submitted by this baseline. Failure-send tests
        // require a fresh verified fixture block_delivery control immediately before Send.
        device.pressBack();
        device.pressBack();
        label("Discard This Message?", "Odrzucić wiadomość?");
        label("Discard", "Odrzuć").click();
    }

    private JSONObject deliveryControl() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL("http://127.0.0.1:8768/__native_qa_control").openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        try {
            assertEquals(200, connection.getResponseCode());
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            try (java.io.InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    assertTrue("Unexpected control response size", bytes.size() + count <= 16384);
                    bytes.write(buffer, 0, count);
                }
            }
            JSONObject control = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            assertEquals("compose-503", control.getString("mode"));
            assertTrue("Refusing any real feedback delivery", control.getBoolean("block_delivery"));
            assertEquals("online", control.getString("network"));
            return control;
        } finally {
            connection.disconnect();
        }
    }

    @Test public void blockedFeedbackFailureRetainsDraftAndRequiresExplicitDiscard() throws Exception {
        JSONObject before = deliveryControl();
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("testownik://feedback"));
        intent.setPackage(PACKAGE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        UiObject2 subject = label("Subject", "Temat");
        assertEquals("android.widget.EditText", subject.getClassName());
        subject.click();
        subject.setText("Synthetic failed feedback");
        UiObject2 message = label("Message", "Wiadomość");
        assertEquals("android.widget.EditText", message.getClassName());
        message.click();
        message.setText("Retain this synthetic message after service failure.");
        assertEquals("Synthetic failed feedback", subject.getText());
        assertEquals("Retain this synthetic message after service failure.", message.getText());
        device.pressBack();
        // Recheck fail-closed control immediately before the only submit.
        deliveryControl();
        label("Send", "Wyślij").click();
        label("Disposable native QA service unavailable.", "Disposable native QA service unavailable.");
        assertNotNull(device.findObject(By.text("Synthetic failed feedback")));
        assertNotNull(device.findObject(By.text("Retain this synthetic message after service failure.")));
        JSONObject after = deliveryControl();
        assertEquals(before.getJSONObject("intercepted").getInt("feedback") + 1, after.getJSONObject("intercepted").getInt("feedback"));
        device.pressBack();
        label("Discard This Message?", "Odrzucić wiadomość?");
        label("Discard", "Odrzuć").click();
    }

    private void qaAssertLargeDarkConfiguration() {
        android.content.res.Configuration configuration = InstrumentationRegistry
            .getInstrumentation().getTargetContext().getResources().getConfiguration();
        assertTrue("Host must apply large font before launch: " + configuration.fontScale,
            configuration.fontScale >= 1.3f);
        assertEquals("Host must apply dark mode before launch",
            android.content.res.Configuration.UI_MODE_NIGHT_YES,
            configuration.uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK);
    }

    private void qaCaptureLargeText(String name, UiObject2 text) throws Exception {
        assertNotNull(name, text);
        device.waitForIdle();
        android.graphics.Rect bounds = text.getVisibleBounds();
        assertFalse("Footer must expose visible bounds", bounds.isEmpty());
        assertTrue("Position text clear of screen edges before judging glyph clipping",
            bounds.top > 64 && bounds.bottom < device.getDisplayHeight() - 64);
        File directory = new File(InstrumentationRegistry.getInstrumentation()
            .getTargetContext().getExternalFilesDir(null), "native-qa");
        assertTrue(directory.isDirectory() || directory.mkdirs());
        android.content.res.Configuration configuration = InstrumentationRegistry
            .getInstrumentation().getTargetContext().getResources().getConfiguration();
        String unique = name + "-" + configuration.getLocales().toLanguageTags().replaceAll("[^A-Za-z0-9_-]", "_")
            + "-scale" + configuration.fontScale + "-" + System.currentTimeMillis();
        device.takeScreenshot(new File(directory, unique + ".png"));
        device.dumpWindowHierarchy(new File(directory, unique + ".xml"));
        // visibleBounds and full AX text do NOT prove all glyphs are drawn. Root
        // reviews screenshots. Scroll footer clear of native bars before capture.
    }

    private UiObject2 qaRevealAndroidFooter(String english, String polish) {
        Pattern text = Pattern.compile(Pattern.quote(english) + "|" + Pattern.quote(polish));
        int previousHeight = -1;
        int previousTop = -1;
        for (int attempt = 0; attempt < 32; attempt++) {
            device.waitForIdle();
            UiObject2 result = device.findObject(By.text(text));
            if (result != null) {
                android.graphics.Rect bounds = result.getVisibleBounds();
                UiObject2 scroll = device.findObject(By.scrollable(true));
                assertNotNull("Verify scroll container before footer visibility", scroll);
                android.graphics.Rect viewport = scroll.getVisibleBounds();
                boolean clear = !bounds.isEmpty() && bounds.top > Math.max(64, viewport.top + 12)
                    && bounds.bottom < Math.min(device.getDisplayHeight() - 64, viewport.bottom - 12);
                if (clear && bounds.height() == previousHeight && bounds.top != previousTop)
                    return device.findObject(By.text(text));
                if (clear) {
                    int shift = bounds.top == previousTop ? 24 : -24;
                    previousHeight = bounds.height(); previousTop = bounds.top;
                    device.swipe(8, device.getDisplayHeight() / 2,
                        8, device.getDisplayHeight() / 2 + shift, 80);
                    continue;
                }
                else { previousHeight = -1; previousTop = -1; }
                // A partial visible rect can conceal clipping. Move toward center.
                if (bounds.top <= 64) {
                    device.swipe(8, device.getDisplayHeight() / 3,
                        8, device.getDisplayHeight() / 2, 80);
                    continue;
                }
            }
            // Left gutter avoids switches, slider tracks and destructive controls.
            device.swipe(8, device.getDisplayHeight() * 3 / 4,
                8, device.getDisplayHeight() / 2, 80);
        }
        fail("Footer not fully positioned; capture current screen and review before diagnosing truncation");
        return null;
    }

    @Test public void syntheticLargeTextDarkStudySettingsFooters() throws Exception {
        // Existing @Before verifies isolated package, OAuth fixture, synthetic name
        // and email. Use host force-stop of QA package between appearance runs.
        org.junit.Assume.assumeTrue("Opt-in isolated large-text/dark screenshot QA only",
            "true".equals(InstrumentationRegistry.getArguments().getString("largeTextQa")));
        qaAssertLargeDarkConfiguration();
        // Explicit package deep link keeps an offscreen Profile row out of this
        // footer test. The existing navigation baseline covers the row separately.
        Intent settings = new Intent(Intent.ACTION_VIEW, Uri.parse("testownik://settings"));
        settings.setPackage(PACKAGE);
        settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(settings);
        assertNotNull("Settings list must mount before footer scrolling",
            device.wait(Until.findObject(By.scrollable(true)), 15000));
        UiObject2 repetition = qaRevealAndroidFooter(
            "A question is mastered after this many correct answers. A wrong answer adds more repetitions.",
            "Pytanie jest opanowane po tylu poprawnych odpowiedziach. Błędna odpowiedź dodaje kolejne powtórki.");
        qaCaptureLargeText("android-large-dark-repetition", repetition);
        UiObject2 notifications = qaRevealAndroidFooter(
            "Changes are saved automatically.", "Zmiany zapisują się automatycznie.");
        qaCaptureLargeText("android-large-dark-notifications", notifications);
        // No switches, model choice, sliders, message Send or notification rows.
    }
}
