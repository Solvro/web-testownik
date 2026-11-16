package pl.solvro.testownik;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.IBinder;
import androidx.test.runner.AndroidJUnitRunner;

/** Separate opt-in runner: never constructs the app's Application or Activities. */
public class StorageLimitsRunner extends AndroidJUnitRunner {
    @Override public Application newApplication(ClassLoader loader, String name, Context context)
            throws ClassNotFoundException, IllegalAccessException, InstantiationException {
        // Application construction precedes onCreate(args), so replacement
        // must be unconditional for this separately registered runner.
        return super.newApplication(loader, Application.class.getName(), context);
    }
    @Override public void onCreate(Bundle arguments) {
        if (!"true".equals(arguments.getString("isolatedStorageProbe")) ||
            !StorageLimits.class.getName().equals(arguments.getString("class")))
            throw new IllegalArgumentException("Only the explicit isolated storage probe is allowed");
        super.onCreate(arguments);
    }
    @Override public void callApplicationOnCreate(Application application) {
        if (application.getClass() != Application.class)
            throw new IllegalStateException("Production Application must not start in the probe");
        super.callApplicationOnCreate(application);
    }
    @Override public Activity newActivity(ClassLoader loader, String name, Intent intent) {
        throw new IllegalStateException("Activities are forbidden in the storage probe");
    }
    @Override public Activity newActivity(Class<?> type, Context context, IBinder token,
            Application application, Intent intent, ActivityInfo info, CharSequence title,
            Activity parent, String id, Object lastNonConfigurationInstance) {
        throw new IllegalStateException("Activities are forbidden in the storage probe");
    }
}

