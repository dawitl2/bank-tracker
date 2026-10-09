package com.banktracker.boasms;

import org.junit.Test;
import static org.junit.Assert.*;

public class BoaSmsParserTest {
    @Test public void extractsReceiptDetailsWithoutIncludingAccountSuffixInReference() {
        BoaSmsUpdate update = BoaSmsParser.parse("BOA", "Your account was debited with ETB 1,200.50 on 09/10/2026 11:30. Reference: FT26282TEST. Narrative: Materials Available balance: ETB 4,000.00 https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349");
        assertEquals("1200.50", update.latestWithdrawalAmount);
        assertEquals("4000.00", update.currentBalance);
        assertEquals("FT26282TEST", update.reference);
        assertEquals("09/10/2026 11:30", update.transactionDate);
        assertEquals("Materials", update.narrative);
        assertEquals("https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349", update.receiptUrl);
    }
    @Test public void doesNotGuessAReferenceFromTheReceiptToken() {
        BoaSmsUpdate update = BoaSmsParser.parse("Bank of Abyssinia", "Account debited with Birr 200. Available balance is Birr 900. https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349");
        assertNull(update.reference);
        assertNotNull(update.receiptUrl);
    }
    @Test public void creditsAndMissingFieldsRemainDistinct() {
        BoaSmsUpdate update = BoaSmsParser.parse("BOA", "Account credited with ETB 100.00. Current balance is ETB 200.00");
        assertEquals("100.00", update.latestDepositAmount);
        assertNull(update.latestWithdrawalAmount);
        assertNull(update.narrative);
        assertNull(update.transactionDate);
    }
    @Test public void ignoresOtherSendersOtpsAndPromotions() {
        assertNull(BoaSmsParser.parse("+251900000000", "Account debited with ETB 200"));
        assertNull(BoaSmsParser.parse("BOA", "OTP 12345. Account balance ETB 200"));
        assertNull(BoaSmsParser.parse("BOA", "Promotion: deposit ETB 200 for a bonus"));
    }
}
