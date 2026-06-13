package com.banktracker.boasms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SmsReceiver extends BroadcastReceiver {
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) {
            return;
        }

        StringBuilder body = new StringBuilder();
        String sender = messages[0].getDisplayOriginatingAddress();
        long receivedAt = System.currentTimeMillis();

        for (SmsMessage message : messages) {
            body.append(message.getMessageBody());
            receivedAt = Math.max(receivedAt, message.getTimestampMillis());
        }

        BoaSmsUpdate update = BoaSmsParser.parse(sender, body.toString());
        if (update == null) {
            return;
        }

        PendingResult pendingResult = goAsync();
        long finalReceivedAt = receivedAt;
        String finalSender = sender;
        String finalBody = body.toString();
        Context appContext = context.getApplicationContext();

        EXECUTOR.execute(() -> {
            try {
                ApiClient.sendUpdate(appContext, update, finalSender, finalReceivedAt, sha256(finalSender + "\n" + finalBody));
                SettingsStore.setLastExtracted(appContext, SmsTools.describeUpdate(update, finalSender, finalReceivedAt));
                SettingsStore.setLastStatus(appContext, "Last BOA update sent successfully.");
            } catch (Exception error) {
                SettingsStore.setLastStatus(appContext, "Last BOA update failed: " + error.getMessage());
            } finally {
                pendingResult.finish();
            }
        });
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
