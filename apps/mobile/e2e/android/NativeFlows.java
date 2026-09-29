package pl.solvro.testownik;

import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.Direction;
import androidx.test.uiautomator.Configurator;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.Rule;
import org.junit.rules.TestName;
import static org.junit.Assume.assumeTrue;
import java.io.File;
import java.util.regex.Pattern;
import static org.junit.Assert.*;

/** Native Material navigation checks against the disposable local API. */
@RunWith(AndroidJUnit4.class)
public class NativeFlows {
    @Rule public TestName testName = new TestName();
    private UiDevice device;
    private String originalNightMode;
    private String originalFontScale;
    private String originalKeyboardVisibility;
    private String originalHandwriting;

    @Before public void launch() throws Exception {
        boolean manual = "manualUSOSSignIn".equals(testName.getMethodName());
        boolean accountCheck = ("authenticatedAccountNavigation".equals(testName.getMethodName())
            || "existingQuizQuickActions".equals(testName.getMethodName()))
            && "true".equals(InstrumentationRegistry.getArguments().getString("realAccount"));
        boolean fixture = "true".equals(InstrumentationRegistry.getArguments().getString("disposableFixture"));
        assumeTrue("Provider sign-in is opt-in; regression tests require a disposable database.",
            manual ? "true".equals(InstrumentationRegistry.getArguments().getString("manualUSOS")) : fixture || accountCheck);
        Configurator.getInstance().setWaitForIdleTimeout(1000);
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        originalKeyboardVisibility = device.executeShellCommand("settings get secure show_ime_with_hard_keyboard").trim();
        originalHandwriting = device.executeShellCommand("settings get secure stylus_handwriting_enabled").trim();
        device.executeShellCommand("settings put secure show_ime_with_hard_keyboard 1");
        device.executeShellCommand("settings put secure stylus_handwriting_enabled 0");
        originalNightMode = device.executeShellCommand("cmd uimode night").trim().replace("Night mode: ", "");
        originalFontScale = device.executeShellCommand("settings get system font_scale").trim();
        String appearance = InstrumentationRegistry.getArguments().getString("appearance");
        if ("dark".equals(appearance)) device.executeShellCommand("cmd uimode night yes");
        if ("large".equals(InstrumentationRegistry.getArguments().getString("textSize")))
            device.executeShellCommand("settings put system font_scale 1.3");
        // The development-only Tools bubble overlaps the native search affordance.
        InstrumentationRegistry.getInstrumentation().getTargetContext()
            .getSharedPreferences("expo.modules.devmenu.sharedpreferences", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("showFab", false).putBoolean("showsAtLaunch", false)
            .putBoolean("isOnboardingFinished", true).commit();
        Intent intent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("exp+testownik://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"));
        intent.setPackage("pl.solvro.testownik");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (!device.hasObject(By.desc("Biblioteka").clazz("android.widget.FrameLayout")))
            InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        UiObject2 onboarding = device.wait(Until.findObject(By.text("Continue")), 5000);
        if (onboarding != null) onboarding.click();
        UiObject2 devMenu = device.wait(Until.findObject(By.desc("Close")), 1500);
        if (devMenu != null && device.hasObject(By.text("Reload"))) devMenu.click();
        UiObject2 welcome = device.wait(Until.findObject(By.text("Ucz się po swojemu.")), 5000);
        if (manual || accountCheck) return;
        if (welcome != null) {
            UiObject2 guest = device.findObject(By.text("Wypróbuj jako gość"));
            for (int attempt = 0; attempt < 3 && guest == null; attempt++) {
                UiObject2 scroll = device.findObject(By.scrollable(true));
                if (scroll == null) break;
                scroll.scroll(Direction.DOWN, 0.5f);
                guest = device.findObject(By.text("Wypróbuj jako gość"));
            }
            assertNotNull("Guest login should remain reachable at large text", guest);
            guest.click();
        }
    }

    @After public void restoreAppearance() throws Exception {
        if (device == null) return;
        restoreSecureSetting("show_ime_with_hard_keyboard", originalKeyboardVisibility);
        restoreSecureSetting("stylus_handwriting_enabled", originalHandwriting);
        if ("yes".equals(originalNightMode) || "no".equals(originalNightMode) || "auto".equals(originalNightMode))
            device.executeShellCommand("cmd uimode night " + originalNightMode);
        if (originalFontScale != null && originalFontScale.matches("[0-9.]+"))
            device.executeShellCommand("settings put system font_scale " + originalFontScale);
        else if ("null".equals(originalFontScale)) device.executeShellCommand("settings delete system font_scale");
    }

    private void restoreSecureSetting(String key, String value) throws Exception {
        if ("0".equals(value) || "1".equals(value)) device.executeShellCommand("settings put secure " + key + " " + value);
        else if ("null".equals(value)) device.executeShellCommand("settings delete secure " + key);
    }

    @Test public void manualUSOSSignIn() throws Exception {
        UiObject2 signIn = device.wait(Until.findObject(By.text("Kontynuuj przez USOS")), 15000);
        assumeTrue("Start from the login screen; existing accounts are preserved.", signIn != null);
        signIn.click();
        // The user completes provider credentials in the system browser.
        UiObject2 profile = device.wait(Until.findObject(By.desc("Profil").clazz("android.widget.FrameLayout")), 600000);
        assertNotNull("USOS did not return to the native app.", profile);
        profile.click();
        label("Konto i pomoc");
        assertFalse("USOS must establish an authenticated account", device.hasObject(By.text("Konto gościa")));
        device.pressHome();
        Intent intent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("exp+testownik://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"));
        intent.setPackage("pl.solvro.testownik");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        InstrumentationRegistry.getInstrumentation().getContext().startActivity(intent);
        tab("Profil").click();
        label("Konto i pomoc");
        assertFalse(device.hasObject(By.text("Konto gościa")));
    }

    @Test public void authenticatedAccountNavigation() throws Exception {
        tab("Profil").click();
        label("Konto i pomoc");
        assertFalse("Expected the user's signed-in account", device.hasObject(By.text("Konto gościa")));
        assertFalse("AI administration is web-only", device.hasObject(By.text("Administracja AI")));
        capture("android-authenticated-profile");
        tab("Biblioteka").click();
        for (String title : new String[]{"Nauka", "Biblioteka", "Oceny", "Profil"}) label(title);
        capture("android-authenticated-library");
        tab("Nauka").click();
        capture("android-authenticated-study");
    }

    @Test public void existingQuizQuickActions() throws Exception {
        tab("Nauka").click();
        label("Kontynuuj naukę").click();
        UiObject2 hint = label("Podpowiedź AI");
        capture("android-before-hint");
        hint.click();
        capture("android-after-hint");
        label("Wróć do pytania").click();
        label("Asystent").click();
        label("Rozmawiasz o tym pytaniu");
        fill("Pytanie do asystenta", "Explain this question");
        UiObject2 keyboardOptions = device.findObject(By.desc("Open more keyboard options"));
        if (keyboardOptions != null) {
            keyboardOptions.click();
            capture("android-keyboard-options");
        }
        UiObject2 send = device.wait(Until.findObject(By.clickable(true).enabled(true).hasDescendant(By.text("Wyślij pytanie"))), 10000);
        assertNotNull("A typed prompt must enable sending", send);
        UiObject2 keyboard = device.wait(Until.findObject(By.pkg("com.google.android.inputmethod.latin")), 5000);
        assertNotNull("Assistant composer must open the native keyboard", keyboard);
        capture("android-account-assistant-keyboard");
        assertTrue("Send must remain above the keyboard", label("Wyślij pytanie").getVisibleBounds().bottom <= keyboard.getVisibleBounds().top);
        // No paid request and no quiz answer are submitted.
        device.pressBack();
        device.pressBack();
        label("Podpowiedź AI");
    }

    private UiObject2 tab(String title) {
        UiObject2 result = device.wait(Until.findObject(By.desc(title).clazz("android.widget.FrameLayout")), 20000);
        assertNotNull("Missing tab: " + title, result);
        return result;
    }

    private UiObject2 label(String label) {
        UiObject2 result = device.wait(Until.findObject(By.text(label)), 15000);
        if (result == null) result = device.wait(Until.findObject(By.desc(label)), 1000);
        if (result == null) {
            try { capture("android-missing-control"); }
            catch (Exception failure) { System.out.println("Could not capture missing control: " + failure); }
        }
        assertNotNull("Missing native control: " + label, result);
        return result;
    }

    private void capture(String name) throws Exception {
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "native-tests");
        directory.mkdirs();
        device.takeScreenshot(new File(directory, name + ".png"));
        device.dumpWindowHierarchy(new File(directory, name + ".xml"));
    }

    private void assertBackground(int expected) throws Exception {
        long deadline = android.os.SystemClock.uptimeMillis() + 10000;
        int actual = 0;
        do {
            android.graphics.Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull("Native screenshot missing", screenshot);
            actual = screenshot.getPixel(0, screenshot.getHeight() / 2);
            screenshot.recycle();
            if (actual == expected) return;
            android.os.SystemClock.sleep(100);
        } while (android.os.SystemClock.uptimeMillis() < deadline);
        assertEquals("The content background must follow system appearance", expected, actual);
    }

    @Test public void systemAppearanceChangesWhileOpen() throws Exception {
        try {
            tab("Biblioteka").click();
            device.executeShellCommand("cmd uimode night no");
            assertBackground(android.graphics.Color.rgb(244, 246, 250));
            capture("android-live-light");
            device.executeShellCommand("cmd uimode night yes");
            assertBackground(android.graphics.Color.rgb(16, 24, 38));
            capture("android-live-dark");
        } catch (Throwable failure) {
            capture("android-appearance-failure");
            throw failure;
        }
    }

    @Test public void navigationLabelsAndNativeSearch() throws Exception {
        try {
            UiObject2 guest = device.wait(Until.findObject(By.text("Wypróbuj jako gość")), 5000);
            if (guest != null) guest.click();
            tab("Biblioteka").click();
            for (String title : new String[]{"Nauka", "Biblioteka", "Oceny", "Profil"}) {
                UiObject2 tab = label(title);
                assertFalse("Empty visible tab label: " + title, tab.getVisibleBounds().isEmpty());
            }
            capture("android-library-labels");
            UiObject2 search = device.wait(Until.findObject(By.clazz(Pattern.compile("android.widget.(EditText|AutoCompleteTextView)"))), 5000);
            if (search == null) {
                UiObject2 searchButton = device.findObject(By.desc("Search"));
                assertNotNull("Native search affordance missing", searchButton);
                searchButton.click();
                search = device.wait(Until.findObject(By.clazz(Pattern.compile("android.widget.(EditText|AutoCompleteTextView)"))), 5000);
            }
            assertNotNull("Native search field missing", search);
            search.setText("Native search no matching quiz 0192");
            device.pressBack();
            label("Nie znaleziono quizów");
            capture("android-native-search");
            tab("Profil").click();
            label("Konto i pomoc");
            capture("android-profile");
        } catch (Throwable failure) {
            capture("android-failure");
            throw failure;
        }
    }

    private void fill(String placeholder, String value) {
        UiObject2 input = null;
        for (int attempt = 0; attempt < 5 && input == null; attempt++) {
            input = device.findObject(By.clazz("android.widget.EditText").hasDescendant(By.text(placeholder)));
            if (input == null) input = device.findObject(By.clazz("android.widget.EditText").text(placeholder));
            if (input == null) {
                UiObject2 scroll = device.findObject(By.scrollable(true));
                if (scroll == null || !scroll.scroll(Direction.DOWN, 0.5f)) break;
            }
        }
        assertNotNull("Missing editor input: " + placeholder, input);
        input.click();
        input.setText(value);
    }

    @Test public void createQuizAndUseStudyQuickActions() throws Exception {
        try {
            tab("Biblioteka").click();
            label("Dodaj do biblioteki").click();
            label("Nowy quiz").click();
            label("Tytuł quizu");
            fill("Tytuł quizu", "Native Android " + System.currentTimeMillis());
            fill("Treść pytania", "Native Android question");
            fill("Odpowiedź 1", "Correct native answer");
            fill("Odpowiedź 2", "Wrong native answer");
            UiObject2 keyboard = device.wait(Until.findObject(By.pkg("com.google.android.inputmethod.latin")), 5000);
            assertNotNull("Editor test must exercise the real on-screen keyboard", keyboard);
            assertTrue("Save must remain above the keyboard", label("Zapisz quiz").getVisibleBounds().bottom <= keyboard.getVisibleBounds().top);
            capture("android-editor-keyboard");
            label("Zapisz quiz").click();
            label("Native Android question");
            assertNotNull(label("Podpowiedź AI"));
            assertNotNull(label("Asystent"));
            capture("android-study");
            label("Wrong native answer");
            label("Correct native answer").click();
            label("Podpowiedź AI").click();
            label("Wróć do pytania");
            capture("android-hint-sheet");
            label("Wróć do pytania").click();
            label("Asystent").click();
            label("Rozmawiasz o tym pytaniu");
            fill("Pytanie do asystenta", "Explain this question");
            keyboard = device.wait(Until.findObject(By.pkg("com.google.android.inputmethod.latin")), 5000);
            assertNotNull("Assistant composer must open the native keyboard", keyboard);
            assertTrue("Send must remain above the keyboard", label("Wyślij pytanie").getVisibleBounds().bottom <= keyboard.getVisibleBounds().top);
            capture("android-assistant-keyboard");
            device.pressBack();
            device.pressBack();
            UiObject2 check = device.wait(Until.findObject(By.clickable(true).enabled(true).hasDescendant(By.text("Sprawdź odpowiedź"))), 10000);
            assertNotNull("Check must become enabled after choosing an answer", check);
            check.click();
            label("Dobra odpowiedź!");
            label("Wyjaśnienie AI");
            capture("android-study-feedback");
            label("Dalej").click();
        } catch (Throwable failure) {
            capture("android-study-failure");
            throw failure;
        }
    }
}
