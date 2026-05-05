(function () {
  "use strict";

  const INVITE_PREFIX = "https://ascension.gg/user/invite/";
  const INVITE_URL_PATTERN =
    /https:\/\/ascension\.gg\/user\/invite\/[^\s<>"']+/g;
  const ACTION_FLAG = "__inviteCatcherHasActed";
  const seenInviteLinks = new Set();
  const startTime = Date.now();
  let observerStartedAt = 0;

  if (typeof window[ACTION_FLAG] !== "boolean") {
    window[ACTION_FLAG] = false;
  }

  console.log("[Invite Catcher] Script started");

  function handleInviteLink(rawLink) {
    if (typeof rawLink !== "string") {
      return;
    }

    const link = rawLink.trim();

    if (!link.startsWith(INVITE_PREFIX)) {
      return;
    }

    if (seenInviteLinks.has(link)) {
      return;
    }

    seenInviteLinks.add(link);
    console.log("[Invite Catcher] INVITE FOUND: " + link);

    if (window[ACTION_FLAG]) {
      console.log("[Invite Catcher] already acted, ignoring invite");
      return;
    }

    window[ACTION_FLAG] = true;
    actOnInvite(link);
  }

  async function actOnInvite(link) {
    const delay = Math.floor(Math.random() * 451) + 250;

    console.log("[Invite Catcher] copying invite to clipboard");

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API is not available");
      }

      await navigator.clipboard.writeText(link);
    } catch (error) {
      console.error("[Invite Catcher] clipboard write failed", error);
    }

    console.log("[Invite Catcher] opening invite in " + delay + "ms");

    window.setTimeout(function () {
      window.open(link, "_blank");
      console.log("[Invite Catcher] invite opened");
    }, delay);
  }

  function processText(text) {
    if (!text) {
      return;
    }

    const matches = text.match(INVITE_URL_PATTERN);

    if (!matches) {
      return;
    }

    for (const match of matches) {
      handleInviteLink(match);
    }
  }

  function processAnchors(element) {
    const anchors = [];

    try {
      if (element.matches("a")) {
        anchors.push(element);
      }

      const nestedAnchors = element.querySelectorAll("a");

      for (const anchor of nestedAnchors) {
        anchors.push(anchor);
      }
    } catch (error) {
      return;
    }

    for (const anchor of anchors) {
      handleInviteLink(anchor.href);
    }
  }

  function parseTimeOfDay(timeText, baseDate) {
    const match = timeText
      .trim()
      .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);

    if (!match) {
      return null;
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    const meridiem = match[4] ? match[4].toUpperCase() : "";

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds) ||
      hours > 23 ||
      minutes > 59 ||
      seconds > 59
    ) {
      return null;
    }

    if (meridiem === "PM" && hours < 12) {
      hours += 12;
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }

    const parsedDate = new Date(baseDate);
    parsedDate.setHours(hours, minutes, seconds, 0);

    return parsedDate;
  }

  function parseTimestampValue(value) {
    if (!value) {
      return null;
    }

    const text = value.trim();

    if (!text) {
      return null;
    }

    const directTimestamp = Date.parse(text);

    if (Number.isFinite(directTimestamp)) {
      return new Date(directTimestamp);
    }

    const normalizedTimestamp = Date.parse(text.replace(/\bat\b/i, " "));

    if (Number.isFinite(normalizedTimestamp)) {
      return new Date(normalizedTimestamp);
    }

    const relativeMatch = text.match(/^(Today|Yesterday)\s+at\s+(.+)$/i);

    if (!relativeMatch) {
      return null;
    }

    const baseDate = new Date(startTime);

    if (relativeMatch[1].toLowerCase() === "yesterday") {
      baseDate.setDate(baseDate.getDate() - 1);
    }

    return parseTimeOfDay(relativeMatch[2], baseDate);
  }

  function extractMessageTimestamp(messageContainer) {
    const timestampCandidates = [];

    try {
      const timeElement = messageContainer.querySelector("time");

      if (timeElement) {
        timestampCandidates.push(timeElement.getAttribute("datetime"));
        timestampCandidates.push(timeElement.getAttribute("aria-label"));
        timestampCandidates.push(timeElement.getAttribute("title"));
        timestampCandidates.push(timeElement.textContent);
      }

      const ariaLabelElements = messageContainer.querySelectorAll("[aria-label]");

      for (const ariaLabelElement of ariaLabelElements) {
        timestampCandidates.push(ariaLabelElement.getAttribute("aria-label"));
      }
    } catch (error) {
      return null;
    }

    for (const candidate of timestampCandidates) {
      const parsedTimestamp = parseTimestampValue(candidate);

      if (parsedTimestamp) {
        return parsedTimestamp;
      }
    }

    return null;
  }

  function isNewMessage(messageContainer, observedAt) {
    const messageTimestamp = extractMessageTimestamp(messageContainer);

    if (messageTimestamp) {
      if (messageTimestamp.getTime() < startTime) {
        console.log("[Invite Catcher] skipping old message");
        return false;
      }

      console.log("[Invite Catcher] processing new message");
      return true;
    }

    if (observerStartedAt > 0 && observedAt >= observerStartedAt) {
      console.log("[Invite Catcher] processing new message");
      return true;
    }

    console.log("[Invite Catcher] skipping old message");
    return false;
  }

  function getMessageTargets(element) {
    const messageTargets = [];

    try {
      const closestMessage = element.closest('[role="article"]');

      if (closestMessage) {
        messageTargets.push({
          messageContainer: closestMessage,
          scanElement: element,
        });
        return messageTargets;
      }

      const nestedMessages = element.querySelectorAll('[role="article"]');

      for (const nestedMessage of nestedMessages) {
        messageTargets.push({
          messageContainer: nestedMessage,
          scanElement: nestedMessage,
        });
      }
    } catch (error) {
      return messageTargets;
    }

    return messageTargets;
  }

  function processAddedNode(node, observedAt) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const messageTargets = getMessageTargets(node);

    for (const messageTarget of messageTargets) {
      if (!isNewMessage(messageTarget.messageContainer, observedAt)) {
        continue;
      }

      processText(messageTarget.scanElement.innerText || "");
      processAnchors(messageTarget.scanElement);
    }
  }

  function startObserver() {
    const observer = new MutationObserver(function (mutationRecords) {
      const observedAt = Date.now();

      for (const mutationRecord of mutationRecords) {
        for (const addedNode of mutationRecord.addedNodes) {
          processAddedNode(addedNode, observedAt);
        }
      }
    });

    observerStartedAt = Date.now();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log("[Invite Catcher] Observer started");
  }

  window.setTimeout(startObserver, 3000);
})();
