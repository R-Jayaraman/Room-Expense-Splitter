package com.roomexpensesplit.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must be called before super.onCreate() — installs the Android
        // 12+ splash screen using the branded background/icon from
        // styles.xml (AppTheme.NoActionBarLaunch) instead of the OS default.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
