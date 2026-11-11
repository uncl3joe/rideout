-- ============================================================
-- ROC Update 10 (v29): Minus-Provisionen bereinigen
-- ------------------------------------------------------------
-- Setzt bei allen bereits gespeicherten Auftraegen eine negative Provision auf 0.
-- Der Reingewinn bleibt unveraendert (die Werkstatt traegt den Verlust),
-- nur die Provision des Mechanikers wird nie negativ.
-- Einmalig in Supabase ausfuehren. Gefahrlos, betrifft nur Minus-Provisionen.
-- ============================================================

update orders set provision = 0 where provision < 0;
