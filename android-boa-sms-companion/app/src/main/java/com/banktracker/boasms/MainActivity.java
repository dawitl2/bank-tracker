package com.banktracker.boasms;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Telephony;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int SMS_PERMISSION_REQUEST = 1001;
    private static final long SMS_SYNC_WINDOW_MILLIS = 31L * 24L * 60L * 60L * 1000L;
    private static final String BOA_SENDER_SELECTION =
        Telephony.Sms.ADDRESS + " LIKE ? OR "
            + Telephony.Sms.ADDRESS + " LIKE ? OR "
            + Telephony.Sms.ADDRESS + " LIKE ? OR "
            + Telephony.Sms.ADDRESS + " LIKE ?";
    private static final String[] BOA_SENDER_ARGS = {
        "%BOA%",
        "%Abyssinia%",
        "%BankOfAbyssinia%",
        "%BOASMS%"
    };
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private TextView permissionStatus;
    private TextView connectionStatus;
    private TextView lastExtracted;
    private TextView lastStatus;
    private EditText apiUrlInput;
    private EditText tokenInput;
    private EditText parserInput;
    private TextView parserOutput;
    private BoaSmsUpdate latestInboxUpdate;
    private String latestInboxSender;
    private String latestInboxBody;
    private long latestInboxDate;

    private static final class PendingSmsUpdate {
        final BoaSmsUpdate update;
        final String sender;
        final String body;
        final long receivedAt;

        PendingSmsUpdate(BoaSmsUpdate update, String sender, String body, long receivedAt) {
            this.update = update;
            this.sender = sender;
            this.body = body;
            this.receivedAt = receivedAt;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        refreshStatus();
        readLatestBoaSms();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
        readLatestBoaSms();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == SMS_PERMISSION_REQUEST) {
            refreshStatus();
            readLatestBoaSms();
        }
    }

    private void buildUi() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setBackgroundColor(Color.rgb(244, 245, 239));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(22), dp(20), dp(22));
        scrollView.addView(root);

        root.addView(text("BOA SMS Companion", 24, true));
        root.addView(text("Token for now: boa123", 15, true));

        permissionStatus = statusText("");
        root.addView(permissionStatus);

        Button permissionButton = button("Grant SMS permissions");
        permissionButton.setOnClickListener(view -> requestPermissions(
            new String[] { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS },
            SMS_PERMISSION_REQUEST
        ));
        root.addView(permissionButton);

        apiUrlInput = input("Backend URL");
        apiUrlInput.setText(SettingsStore.getApiUrl(this));
        root.addView(apiUrlInput);

        tokenInput = input("BOA SMS API token");
        tokenInput.setText(SettingsStore.getApiToken(this));
        root.addView(tokenInput);

        Button saveButton = button("Save and test connection");
        saveButton.setOnClickListener(view -> {
            SettingsStore.saveConnection(this, apiUrlInput.getText().toString(), tokenInput.getText().toString());
            refreshStatus();
            testConnection();
        });
        root.addView(saveButton);

        connectionStatus = statusText("Connection not tested yet.");
        root.addView(connectionStatus);

        root.addView(text("Latest account state", 17, true));
        lastExtracted = statusText(SettingsStore.getLastExtracted(this));
        root.addView(lastExtracted);

        Button refreshInboxButton = button("Refresh latest BOA SMS");
        refreshInboxButton.setOnClickListener(view -> readLatestBoaSms());
        root.addView(refreshInboxButton);

        Button sendLatestButton = button("Update latest balance");
        sendLatestButton.setOnClickListener(view -> sendLatestInboxUpdate());
        root.addView(sendLatestButton);

        root.addView(text("Apollo recent transactions", 17, true));

        Button syncLastMonthButton = button("Sync Apollo transactions");
        syncLastMonthButton.setOnClickListener(view -> syncLastMonth());
        root.addView(syncLastMonthButton);

        root.addView(text("Send status", 17, true));
        lastStatus = statusText(SettingsStore.getLastStatus(this));
        root.addView(lastStatus);

        root.addView(text("Parser test", 17, true));
        parserInput = input("Paste sample BOA SMS to test parser");
        parserInput.setMinLines(4);
        root.addView(parserInput);

        Button testButton = button("Test parser");
        testButton.setOnClickListener(view -> testParser());
        root.addView(testButton);

        parserOutput = statusText("");
        root.addView(parserOutput);

        setContentView(scrollView);
    }

    private void refreshStatus() {
        boolean receiveGranted = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean readGranted = checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        permissionStatus.setText(
            "Receive SMS: " + statusWord(receiveGranted) + "\n"
                + "Read last SMS: " + statusWord(readGranted)
        );
        permissionStatus.setTextColor(receiveGranted && readGranted ? Color.rgb(24, 128, 56) : Color.rgb(180, 80, 0));

        if (lastStatus != null) {
            lastStatus.setText(SettingsStore.getLastStatus(this));
        }

        if (lastExtracted != null) {
            lastExtracted.setText(SettingsStore.getLastExtracted(this));
        }
    }

    private void testConnection() {
        connectionStatus.setText("Testing backend connection...");
        connectionStatus.setTextColor(Color.rgb(80, 80, 80));

        executor.execute(() -> {
            try {
                String response = ApiClient.fetchAccountState(getApplicationContext());
                runOnUiThread(() -> {
                    connectionStatus.setText("Connected. Backend returned:\n" + response);
                    connectionStatus.setTextColor(Color.rgb(24, 128, 56));
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    connectionStatus.setText("Not connected: " + error.getMessage());
                    connectionStatus.setTextColor(Color.rgb(180, 0, 0));
                });
            }
        });
    }

    private void readLatestBoaSms() {
        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            SettingsStore.setLastExtracted(this, "Read SMS permission is needed to show the latest old BOA SMS.");
            refreshStatus();
            return;
        }

        executor.execute(() -> {
            BoaSmsUpdate foundUpdate = null;
            String foundSender = null;
            String foundBody = null;
            long foundDate = 0;

            String[] projection = {
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            };

            try (Cursor cursor = getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                BOA_SENDER_SELECTION,
                BOA_SENDER_ARGS,
                Telephony.Sms.DATE + " DESC"
            )) {
                if (cursor != null) {
                    int senderIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS);
                    int bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY);
                    int dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE);
                    int checked = 0;

                    while (cursor.moveToNext() && checked < 80) {
                        checked++;
                        String sender = cursor.getString(senderIndex);
                        String body = cursor.getString(bodyIndex);
                        BoaSmsUpdate update = BoaSmsParser.parse(sender, body);

                        if (update != null) {
                            foundUpdate = update;
                            foundSender = sender;
                            foundBody = body;
                            foundDate = cursor.getLong(dateIndex);
                            break;
                        }
                    }
                }
            } catch (Exception error) {
                String message = "Could not read SMS inbox: " + error.getMessage();
                runOnUiThread(() -> {
                    lastExtracted.setText(message);
                    lastExtracted.setTextColor(Color.rgb(180, 0, 0));
                });
                return;
            }

            BoaSmsUpdate finalUpdate = foundUpdate;
            String finalSender = foundSender;
            String finalBody = foundBody;
            long finalDate = foundDate;

            runOnUiThread(() -> {
                latestInboxUpdate = finalUpdate;
                latestInboxSender = finalSender;
                latestInboxBody = finalBody;
                latestInboxDate = finalDate;

                if (finalUpdate == null) {
                    lastExtracted.setText("No useful BOA balance/deposit/withdrawal SMS found in the latest inbox messages.");
                    lastExtracted.setTextColor(Color.rgb(180, 80, 0));
                    return;
                }

                String summary = SmsTools.describeUpdate(finalUpdate, finalSender, finalDate);
                SettingsStore.setLastExtracted(this, summary);
                lastExtracted.setText(summary);
                lastExtracted.setTextColor(Color.rgb(24, 128, 56));
            });
        });
    }

    private void sendLatestInboxUpdate() {
        if (latestInboxUpdate == null) {
            readLatestBoaSms();
            lastStatus.setText("No parsed BOA SMS ready yet. Tap refresh, then send again.");
            lastStatus.setTextColor(Color.rgb(180, 80, 0));
            return;
        }

        lastStatus.setText("Sending latest parsed BOA SMS...");
        lastStatus.setTextColor(Color.rgb(80, 80, 80));

        executor.execute(() -> {
            try {
                ApiClient.sendUpdate(
                    getApplicationContext(),
                    latestInboxUpdate,
                    latestInboxSender,
                    latestInboxDate,
                    sha256(latestInboxSender + "\n" + latestInboxBody)
                );
                SettingsStore.setLastStatus(getApplicationContext(), "Latest parsed BOA SMS sent successfully.");
                runOnUiThread(() -> {
                    lastStatus.setText(SettingsStore.getLastStatus(this));
                    lastStatus.setTextColor(Color.rgb(24, 128, 56));
                    testConnection();
                });
            } catch (Exception error) {
                SettingsStore.setLastStatus(getApplicationContext(), "Send failed: " + error.getMessage());
                runOnUiThread(() -> {
                    lastStatus.setText(SettingsStore.getLastStatus(this));
                    lastStatus.setTextColor(Color.rgb(180, 0, 0));
                });
            }
        });
    }

    private void syncLastMonth() {
        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            lastStatus.setText("Read SMS permission is needed to sync the last month.");
            lastStatus.setTextColor(Color.rgb(180, 80, 0));
            return;
        }

        lastStatus.setText("Scanning BOA SMS from the last month for Apollo...");
        lastStatus.setTextColor(Color.rgb(80, 80, 80));

        executor.execute(() -> {
            List<PendingSmsUpdate> updates = new ArrayList<>();
            long cutoff = System.currentTimeMillis() - SMS_SYNC_WINDOW_MILLIS;

            String[] projection = {
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            };

            try (Cursor cursor = getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                Telephony.Sms.DATE + " >= ? AND (" + BOA_SENDER_SELECTION + ")",
                withCutoffArg(cutoff),
                Telephony.Sms.DATE + " ASC"
            )) {
                if (cursor != null) {
                    int senderIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS);
                    int bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY);
                    int dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE);

                    while (cursor.moveToNext()) {
                        String sender = cursor.getString(senderIndex);
                        String body = cursor.getString(bodyIndex);
                        long receivedAt = cursor.getLong(dateIndex);
                        BoaSmsUpdate update = BoaSmsParser.parse(sender, body);

                        if (update != null && (update.latestDepositAmount != null || update.latestWithdrawalAmount != null)) {
                            updates.add(new PendingSmsUpdate(update, sender, body, receivedAt));
                        }
                    }
                }

                if (updates.isEmpty()) {
                    SettingsStore.setLastStatus(getApplicationContext(), "No useful BOA deposit/withdrawal SMS found in the last month.");
                    runOnUiThread(() -> {
                        lastStatus.setText(SettingsStore.getLastStatus(this));
                        lastStatus.setTextColor(Color.rgb(180, 80, 0));
                    });
                    return;
                }

                int sent = 0;

                for (PendingSmsUpdate pending : updates) {
                    ApiClient.sendEventOnly(
                        getApplicationContext(),
                        pending.update,
                        pending.sender,
                        pending.receivedAt,
                        sha256(pending.sender + "\n" + pending.body)
                    );
                    sent++;
                }

                PendingSmsUpdate latest = updates.get(updates.size() - 1);
                SettingsStore.setLastExtracted(
                    getApplicationContext(),
                    SmsTools.describeUpdate(latest.update, latest.sender, latest.receivedAt)
                );
                SettingsStore.setLastStatus(
                    getApplicationContext(),
                    "Synced " + sent + " Apollo transaction rows. Latest balance row was not changed."
                );
                runOnUiThread(() -> {
                    refreshStatus();
                    lastStatus.setText(SettingsStore.getLastStatus(this));
                    lastStatus.setTextColor(Color.rgb(24, 128, 56));
                    testConnection();
                });
            } catch (Exception error) {
                SettingsStore.setLastStatus(getApplicationContext(), "Last-month sync failed: " + error.getMessage());
                runOnUiThread(() -> {
                    lastStatus.setText(SettingsStore.getLastStatus(this));
                    lastStatus.setTextColor(Color.rgb(180, 0, 0));
                });
            }
        });
    }

    private static String[] withCutoffArg(long cutoff) {
        String[] args = new String[BOA_SENDER_ARGS.length + 1];
        args[0] = String.valueOf(cutoff);
        System.arraycopy(BOA_SENDER_ARGS, 0, args, 1, BOA_SENDER_ARGS.length);
        return args;
    }

    private void testParser() {
        BoaSmsUpdate update = BoaSmsParser.parse("BOA", parserInput.getText().toString());

        if (update == null) {
            parserOutput.setText("Ignored. No meaningful BOA account values found.");
            parserOutput.setTextColor(Color.rgb(180, 80, 0));
            return;
        }

        parserOutput.setText(SmsTools.describeUpdate(update, "BOA test", System.currentTimeMillis()));
        parserOutput.setTextColor(Color.rgb(24, 128, 56));
    }

    private String statusWord(boolean ok) {
        return ok ? "granted" : "not granted";
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setPadding(0, dp(8), 0, dp(8));
        textView.setTextColor(Color.rgb(32, 35, 31));

        if (bold) {
            textView.setTypeface(Typeface.DEFAULT_BOLD);
        }

        return textView;
    }

    private TextView statusText(String value) {
        TextView textView = text(value, 14, false);
        textView.setPadding(dp(14), dp(12), dp(14), dp(12));
        textView.setBackgroundColor(Color.TRANSPARENT);
        textView.setBackground(rounded(Color.WHITE, dp(12), Color.rgb(224, 226, 216)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(4), 0, dp(12));
        textView.setLayoutParams(params);
        return textView;
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(false);
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setBackground(rounded(Color.WHITE, dp(10), Color.rgb(210, 214, 202)));
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
        button.setTextColor(Color.rgb(32, 35, 31));
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackground(rounded(Color.rgb(244, 163, 0), dp(10), Color.rgb(224, 146, 0)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(6), 0, dp(8));
        button.setLayoutParams(params);
        return button;
    }

    private GradientDrawable rounded(int color, int radius, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();

        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }

        return hex.toString();
    }
}
