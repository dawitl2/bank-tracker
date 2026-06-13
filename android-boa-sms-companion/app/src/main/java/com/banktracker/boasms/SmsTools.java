package com.banktracker.boasms;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class SmsTools {
    private SmsTools() {
    }

    static String describeUpdate(BoaSmsUpdate update, String sender, long receivedAtMillis) {
        return "Sender: " + value(sender) + "\n"
            + "Received: " + new SimpleDateFormat("MMM d, h:mm a", Locale.US).format(new Date(receivedAtMillis)) + "\n"
            + "Balance: " + value(update.currentBalance) + "\n"
            + "Withdrawal: " + value(update.latestWithdrawalAmount) + "\n"
            + "Deposit: " + value(update.latestDepositAmount);
    }

    private static String value(String value) {
        return value == null || value.trim().isEmpty() ? "0.0" : value;
    }
}
