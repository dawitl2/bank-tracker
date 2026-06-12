package com.banktracker.boasms;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class BoaSmsParser {
    private static final Pattern MONEY_PATTERN = Pattern.compile(
        "(?i)(?:ETB|Birr)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)\\s*(?:ETB|Birr)?"
    );

    private BoaSmsParser() {
    }

    static boolean isBoaSender(String sender) {
        if (sender == null) return false;

        String normalized = sender.toLowerCase(Locale.US).replaceAll("[^a-z0-9]", "");
        return normalized.equals("boa")
            || normalized.contains("bankofabyssinia")
            || normalized.contains("abyssinia")
            || normalized.contains("boabank")
            || normalized.contains("boasms");
    }

    static BoaSmsUpdate parse(String sender, String body) {
        if (!isBoaSender(sender) || body == null) {
            return null;
        }

        String text = body.replace('\n', ' ').replace('\r', ' ').replaceAll("\\s+", " ").trim();
        String lower = text.toLowerCase(Locale.US);

        if (isOtp(lower) || isPromotion(lower) || !containsAccountSignal(lower)) {
            return null;
        }

        String balance = findAmountNearAny(text, new String[] {
            "available balance", "current balance", "new balance", "balance", "avl bal", "avail bal"
        });

        String withdrawal = null;
        if (containsAny(lower, "withdraw", "withdrawn", "debited", "debit", "paid", "purchase", "transferred to", "sent to")) {
            withdrawal = findTransactionAmount(text, new String[] {
                "withdrawn", "withdraw", "debited", "debit", "paid", "purchase", "transferred to", "sent to", "amount"
            });
        }

        String deposit = null;
        if (containsAny(lower, "deposit", "deposited", "credited", "credit", "received", "transferred from")) {
            deposit = findTransactionAmount(text, new String[] {
                "deposited", "deposit", "credited", "credit", "received", "transferred from", "amount"
            });
        }

        BoaSmsUpdate update = new BoaSmsUpdate(balance, withdrawal, deposit);
        return update.hasValues() ? update : null;
    }

    private static boolean isOtp(String lower) {
        return containsAny(lower, "otp", "one time password", "one-time password", "verification code", "security code", "password reset");
    }

    private static boolean isPromotion(String lower) {
        return containsAny(lower, "promo", "promotion", "offer", "discount", "campaign", "win ", "lottery", "bonus", "advert");
    }

    private static boolean containsAccountSignal(String lower) {
        return containsAny(
            lower,
            "balance",
            "avl bal",
            "avail bal",
            "withdraw",
            "withdrawn",
            "debited",
            "credited",
            "deposit",
            "deposited",
            "received",
            "paid"
        );
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }

        return false;
    }

    private static String findAmountNearAny(String text, String[] labels) {
        String lower = text.toLowerCase(Locale.US);

        for (String label : labels) {
            int index = lower.indexOf(label);
            if (index < 0) continue;

            int start = Math.max(0, index - 24);
            int end = Math.min(text.length(), index + label.length() + 80);
            String nearby = text.substring(start, end);
            String amount = firstAmount(nearby);

            if (amount != null) {
                return amount;
            }
        }

        return null;
    }

    private static String findTransactionAmount(String text, String[] labels) {
        String balanceAmount = findAmountNearAny(text, new String[] {
            "available balance", "current balance", "new balance", "balance", "avl bal", "avail bal"
        });
        String labeledAmount = findAmountNearAny(text, labels);

        if (labeledAmount != null && !labeledAmount.equals(balanceAmount)) {
            return labeledAmount;
        }

        Matcher matcher = MONEY_PATTERN.matcher(text);
        while (matcher.find()) {
            String amount = cleanAmount(matcher.group(1));

            if (!amount.equals(balanceAmount)) {
                return amount;
            }
        }

        return null;
    }

    private static String firstAmount(String text) {
        Matcher matcher = MONEY_PATTERN.matcher(text);
        return matcher.find() ? cleanAmount(matcher.group(1)) : null;
    }

    private static String cleanAmount(String amount) {
        return amount == null ? null : amount.replace(",", "");
    }
}
