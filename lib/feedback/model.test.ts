import assert from "node:assert/strict";
import test from "node:test";

import { bugIsValid, classifyByRules, findDuplicate } from "./classify";
import { receiptEmail, sendSupportEmail } from "./mail";
import { replaceDuplicateLine, scoreTicket } from "./model";
import { composeFeedbackBody, readFeedbackAnswers, suggestFeedbackTitle } from "./note";
import {
  BETA_DISCLOSURE,
  BETA_ENDS_AT,
  betaEndsLabel,
  defaultTrade,
  featureRequestBody,
  featureRequestTitle,
  isTradeId,
  needIsValid,
  readFeatureRequestTrade,
  TRADES,
  tradeLabelName,
} from "../beta";

test("a pro trades account with a severe duplicated bug outranks a quiet free note", () => {
  const quiet = scoreTicket({
    plan: "free",
    paidCents: 0,
    events30d: 0,
    industry: null,
    quotes30d: 0,
    duplicateCount: 0,
    severity: "low",
  });
  const urgent = scoreTicket({
    plan: "pro",
    paidCents: 4800,
    events30d: 20,
    industry: "trades",
    quotes30d: 6,
    duplicateCount: 3,
    severity: "high",
  });
  assert.equal(quiet.score, 5);
  assert.ok(urgent.score > quiet.score);
  assert.equal(
    urgent.score,
    urgent.lines.reduce((sum, line) => sum + line.points, 0),
  );
  assert.equal(urgent.lines.find((line) => line.factor === "Plan")?.points, 30);
  assert.equal(urgent.lines.find((line) => line.factor === "Revenue paid")?.points, 25);
  assert.equal(urgent.lines.find((line) => line.factor === "Opportunity")?.points, 20);
  assert.equal(urgent.lines.find((line) => line.factor === "Duplicates")?.points, 12);
  assert.equal(urgent.lines.find((line) => line.factor === "Severity")?.points, 25);
});

test("duplicate requests raise only the duplicate line", () => {
  const first = scoreTicket({
    plan: "plus",
    paidCents: 499,
    events30d: 4,
    industry: "trades",
    quotes30d: 1,
    duplicateCount: 0,
    severity: "medium",
  });
  const next = replaceDuplicateLine(first, 2);
  assert.equal(next.lines.find((line) => line.factor === "Duplicates")?.points, 8);
  assert.equal(next.score, first.score + 8);
});

test("rules call a crash a bug and match an existing note", () => {
  const existing = [{ id: "ticket-1", summary: "The price button crashes on send", body: "Send crashes the price screen" }];
  const classified = classifyByRules("The price button crashes when I tap send", "/guide/1", existing);
  assert.equal(classified.kind, "bug");
  assert.equal(classified.severity, "high");
  assert.equal(classified.duplicateOf, "ticket-1");
  assert.equal(findDuplicate("Add a dark mode for night quotes", existing), null);
  const feature = classifyByRules("Add a dark mode for night quotes", "/menu", existing);
  assert.equal(feature.kind, "feature");
  assert.equal(feature.duplicateOf, null);
});

test("a valid bug needs a real note or a screenshot and is not a duplicate", () => {
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: null, body: "Send crashes", hasShot: false }), true);
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: "other", body: "Send crashes", hasShot: true }), false);
  assert.equal(bugIsValid({ kind: "feature", duplicateOf: null, body: "Add dark mode please", hasShot: true }), false);
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: null, body: "no", hasShot: false }), false);
});

test("email is a no-op when the provider is unset", async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const result = await sendSupportEmail({ to: "ada@example.com", subject: "We got your note", text: receiptEmail({ summary: "Send crashes", kind: "bug", duplicate: false }) });
  assert.equal(result.sent, false);
  assert.equal(result.reason, "unset");
  const empty = await sendSupportEmail({ to: "", subject: "Hi", text: "Hi" });
  assert.equal(empty.reason, "no-address");
  if (previous) process.env.RESEND_API_KEY = previous;
});

test("a feedback note keeps both answers, the box, and a title from the first answer", () => {
  assert.equal(suggestFeedbackTitle("bug", "", "/guide/oak"), "Bug on /guide/oak");
  assert.equal(suggestFeedbackTitle("bug", "The price became $1", "/guide/oak"), "The price became $1");
  const body = composeFeedbackBody({
    title: "Price became $1",
    kind: "bug",
    answerA: "I asked for $1,250 and the card said $1.",
    answerB: "The card should say $1,250.",
    selection: { x: 12, y: 40, w: 200, h: 80 },
    url: "https://example.com/guide/oak",
    viewport: "1280x800",
  });
  const answers = readFeedbackAnswers(body);
  assert.equal(answers.answerA, "I asked for $1,250 and the card said $1.");
  assert.equal(answers.answerB, "The card should say $1,250.");
  assert.equal(answers.selection, "12,40 200x80");
  const idea = composeFeedbackBody({
    title: "Darker toast",
    kind: "feature",
    answerA: "A darker toast",
    answerB: "It is easier to see",
    selection: null,
    url: "https://example.com/",
    viewport: "390x844",
  });
  const read = readFeedbackAnswers(idea);
  assert.equal(read.answerA, "A darker toast");
  assert.equal(read.answerB, "It is easier to see");
});

test("a trade feature request is tagged with its type and trade, and dedupes on the typed need only", () => {
  const body = featureRequestBody({ trade: "flipping", need: "  Margin after fees  ", followUp: true, route: "/feedback/trade?from=beta" });
  assert.match(body, /^Type: feature_request$/m);
  assert.match(body, /^Trade: flipping \(Flipping & resale\)$/m);
  assert.match(body, /^Follow-up email: yes$/m);
  assert.equal(readFeatureRequestTrade(body), "flipping");
  assert.equal(featureRequestTitle("trades", ""), "Feature request (Trades)");
  assert.equal(readFeatureRequestTrade(featureRequestBody({ trade: "home-services", need: "Gutters", followUp: false, route: "" })), "home-services");
  assert.ok(featureRequestTitle("makers", "x".repeat(200)).length <= 80);
  assert.equal(tradeLabelName("food-shop"), "trade:food-shop");
  const other = featureRequestBody({ trade: "other", need: "Dog walking", followUp: false, route: "" });
  assert.equal(findDuplicate("Mileage log", [{ id: "a", summary: "Feature request (Something else)", body: other }]), null);
});

test("trade ids follow the shared taxonomy and default from the account industry", () => {
  assert.deepEqual(
    TRADES.map((trade) => trade.label),
    [
      "Home services & handyman",
      "Trades",
      "Selling personal items",
      "Flipping & resale",
      "Makers & crafts",
      "Events & creative",
      "Food & small shop",
      "Something else",
    ],
  );
  assert.equal(isTradeId("flipping"), true);
  assert.equal(isTradeId("roofing"), false);
  assert.equal(isTradeId(null), false);
  assert.equal(defaultTrade("services"), "home-services");
  assert.equal(defaultTrade("trades"), "trades");
  assert.equal(defaultTrade("yard"), "selling");
  assert.equal(defaultTrade("retail"), "flipping");
  assert.equal(defaultTrade(null), null);
});

test("a feature request needs a few words", () => {
  assert.equal(needIsValid(""), false);
  assert.equal(needIsValid("   \n "), false);
  assert.equal(needIsValid("ok"), false);
  assert.equal(needIsValid("CSV export"), true);
});

test("beta copy matches the approved wording, with the end date from BETA_ENDS_AT", () => {
  assert.equal(BETA_ENDS_AT, "2027-01-31");
  assert.equal(betaEndsLabel(), "Jan 31, 2027");
  assert.equal(
    `${BETA_DISCLOSURE.pricingLead} ${BETA_DISCLOSURE.pricing}`,
    "Beta pricing: plan prices may go up after beta. Subscribe during beta and you'll keep your current price for an extra year after beta ends.",
  );
  assert.equal(
    BETA_DISCLOSURE.firstHundred,
    "The first 100 beta testers get a free pass to everything until beta ends (Jan 31, 2027), then normal pricing applies.",
  );
  assert.equal(
    BETA_DISCLOSURE.pricingShort,
    "Beta price – locked for 1 year after beta for members who subscribe during beta",
  );
  const general = [BETA_DISCLOSURE.body, BETA_DISCLOSURE.meaning, BETA_DISCLOSURE.pricing].join(" ");
  assert.doesNotMatch(general, /\bfree\b|30.day|trial|no charge/i);
});
