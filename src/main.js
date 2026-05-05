(function () {
  "use strict";

  const INVITE_PREFIX = "https://ascension.gg/user/invite/";
  const INVITE_URL_PATTERN =
    /https:\/\/ascension\.gg\/user\/invite\/[^\s<>"']+/g;
  const ACTION_FLAG = "__inviteCatcherHasActed";
  const seenInviteLinks = new Set();

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

  function processAddedNode(node) {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    processText(node.innerText || "");
    processAnchors(node);
  }

  function startObserver() {
    const observer = new MutationObserver(function (mutationRecords) {
      for (const mutationRecord of mutationRecords) {
        for (const addedNode of mutationRecord.addedNodes) {
          processAddedNode(addedNode);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log("[Invite Catcher] Observer started");
  }

  window.setTimeout(startObserver, 3000);
})();
