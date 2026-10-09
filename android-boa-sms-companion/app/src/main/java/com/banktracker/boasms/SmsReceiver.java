package com.banktracker.boasms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

public final class SmsReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;
        String sender = messages[0].getDisplayOriginatingAddress();
        StringBuilder body = new StringBuilder();
        long receivedAt = messages[0].getTimestampMillis();
        for (SmsMessage message : messages) {
            body.append(message.getMessageBody());
            receivedAt = Math.max(receivedAt, message.getTimestampMillis());
        }
        if (receivedAt <= 0) receivedAt = System.currentTimeMillis();
        BoaSmsUpdate update = BoaSmsParser.parse(sender, body.toString());
        if (update == null) return;
        try {
            // Persist before returning from the broadcast. Network work belongs to JobScheduler.
            SmsDelivery.enqueue(context, update, sender, receivedAt, SmsDelivery.hash(sender, body.toString()), false, false);
            SettingsStore.setLastExtracted(context, SmsTools.describeUpdate(update, sender, receivedAt));
            SettingsStore.setLastStatus(context, "BOA SMS saved for delivery.");
            SmsDelivery.schedule(context);
        } catch (Exception error) {
            SettingsStore.setLastStatus(context, "Could not queue BOA SMS: " + error.getMessage());
            SmsDelivery.schedule(context);
        }
    }
}
