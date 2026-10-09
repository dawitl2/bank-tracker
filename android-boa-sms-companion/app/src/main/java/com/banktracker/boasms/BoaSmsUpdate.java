package com.banktracker.boasms;

final class BoaSmsUpdate {
    final String currentBalance;
    final String latestWithdrawalAmount;
    final String latestDepositAmount;
    String reference;
    String transactionDate;
    String narrative;
    String receiptUrl;

    BoaSmsUpdate(String currentBalance, String latestWithdrawalAmount, String latestDepositAmount) {
        this.currentBalance = currentBalance;
        this.latestWithdrawalAmount = latestWithdrawalAmount;
        this.latestDepositAmount = latestDepositAmount;
    }

    boolean hasValues() {
        return currentBalance != null || latestWithdrawalAmount != null || latestDepositAmount != null;
    }
}
