package com.mskctg.cashtracker;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // IMPORTANT: register BEFORE super.onCreate() – the Bridge (and its plugin
        // registry) is built inside super.onCreate(), so a plugin added afterwards
        // would never be registered.
        registerPlugin(SaveFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
