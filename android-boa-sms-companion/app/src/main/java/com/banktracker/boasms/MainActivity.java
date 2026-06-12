package com.banktracker.boasms;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final int SMS_PERMISSION_REQUEST = 1001;

    private TextView permissionStatus;
    private TextView lastStatus;
    private EditText apiUrlInput;
    private EditText tokenInput;
    private EditText parserInput;
    private TextView parserOutput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        refreshStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == SMS_PERMISSION_REQUEST) {
            refreshStatus();
        }
    }

    private void buildUi() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(22), dp(20), dp(22));
        scrollView.addView(root);

        TextView title = text("BOA SMS Companion", 24, true);
        root.addView(title);
        root.addView(text("This app listens for BOA SMS messages, ignores OTPs and promotions, and sends only the latest balance, withdrawal, and deposit values.", 14, false));

        permissionStatus = text("", 15, true);
        root.addView(permissionStatus);

        Button permissionButton = button("Grant SMS permission");
        permissionButton.setOnClickListener(view -> requestPermissions(new String[] { Manifest.permission.RECEIVE_SMS }, SMS_PERMISSION_REQUEST));
        root.addView(permissionButton);

        apiUrlInput = input("Backend URL");
        apiUrlInput.setText(SettingsStore.getApiUrl(this));
        root.addView(apiUrlInput);

        tokenInput = input("BOA SMS API token");
        tokenInput.setText(SettingsStore.getApiToken(this));
        root.addView(tokenInput);

        Button saveButton = button("Save connection");
        saveButton.setOnClickListener(view -> {
            SettingsStore.saveConnection(this, apiUrlInput.getText().toString(), tokenInput.getText().toString());
            refreshStatus();
        });
        root.addView(saveButton);

        lastStatus = text("", 14, false);
        root.addView(lastStatus);

        parserInput = input("Paste sample BOA SMS to test parser");
        parserInput.setMinLines(4);
        root.addView(parserInput);

        Button testButton = button("Test parser");
        testButton.setOnClickListener(view -> testParser());
        root.addView(testButton);

        parserOutput = text("", 14, false);
        root.addView(parserOutput);

        setContentView(scrollView);
    }

    private void refreshStatus() {
        boolean granted = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        permissionStatus.setText(granted ? "SMS permission: granted" : "SMS permission: not granted");

        if (lastStatus != null) {
            lastStatus.setText(SettingsStore.getLastStatus(this));
        }
    }

    private void testParser() {
        BoaSmsUpdate update = BoaSmsParser.parse("BOA", parserInput.getText().toString());

        if (update == null) {
            parserOutput.setText("Ignored. No meaningful BOA account values found.");
            return;
        }

        parserOutput.setText(
            "Balance: " + value(update.currentBalance) + "\n"
                + "Latest withdrawal: " + value(update.latestWithdrawalAmount) + "\n"
                + "Latest deposit: " + value(update.latestDepositAmount)
        );
    }

    private String value(String value) {
        return value == null ? "-" : value;
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setPadding(0, dp(8), 0, dp(8));

        if (bold) {
            textView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        }

        return textView;
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(false);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return input;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
