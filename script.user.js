// ==UserScript==
// @name                        Unfloat
// @namespace                   http://tampermonkey.net/
// @version                     2025-10-18
// @description                 Remaps Float names
// @author                      stenlan
// @match                       FLOAT_URL_HERE
// @resource   translationCSV   CSV_URL_HERE
// @icon                        https://www.google.com/s2/favicons?sz=64&domain=float.com
// @grant                       GM_getResourceText
// @run-at                      document-body
// @sandbox                     DOM
// ==/UserScript==

(function() {
    'use strict';

    const translations = Object.fromEntries(GM_getResourceText("translationCSV").split(/\r?\n/).slice(1).map(line => {
		const splitLine = line.split(";");
		if (splitLine.length < 2) return null;
		return [splitLine[1].trim(), splitLine[0].trim()];
	}).filter(kvp => kvp));

    let currWrapper;

    function windowClicked(ev) {
        if (!currWrapper) return;

        currWrapper.style.width = "100%";
        currWrapper.style.height = "80%";
        currWrapper.lastElementChild.style.display = "none";
    }

    document.addEventListener("pointerdown", windowClicked);

    function populateNode(translationEntry) {
        const translationText = translations[translationEntry.translationKey];
        if (translationEntry.hideElem) {
            translationEntry.hideElem.style.display = "none";
        }

        translationEntry.shadowRoot.innerHTML = translationEntry.prefix;
        translationEntry.shadowRoot.textContent += translationText;
        translationEntry.wrapperElem.style.display = translationEntry.inline ? "inline-flex" : "flex";
    }

    function createTranslationNode(translationKey, extended = false, hideElem = null, prefix = "", inline = false) {
        if (!(translationKey in translations)) {
            // this key isn't included in the translation map; no point in creating a translation node
            return null;
        }

        const wrapper = document.createElement("div");
        if (!inline) wrapper.style.width = "100%";
        wrapper.style.alignItems = "center";

        const textElem = document.createElement("div");

        if (extended) {
            wrapper.style.justifyContent = "center";
            wrapper.style.position = "absolute";
            wrapper.style.backgroundColor = "#ffffff";
            wrapper.style.borderRadius = "0.3em";
            wrapper.style.border = "1px solid red";
            wrapper.style.zIndex = "1";
            wrapper.style.padding = "0 0.2em";
            wrapper.style.flexDirection = "column";
            wrapper.style.alignItems = "start";
            wrapper.style.transition = "width 250ms, height 250ms";
            wrapper.style.height = "80%";

            wrapper.addEventListener("pointerdown", function(ev) {
                if (this.style.height === "170%") return;

                ev.stopPropagation();
                const currWidth = this.getBoundingClientRect().width;
                this.lastElementChild.style.display = "";
                const targetWidth = Math.max(this.lastElementChild.scrollWidth, this.firstElementChild.scrollWidth);
                this.style.width = `${Math.max(1, targetWidth / currWidth) * 120}%`;
                this.style.height = "170%";
            });
            wrapper.style.cursor = "help";
            wrapper.style.userSelect = "none";

            textElem.style.overflow = "hidden";
            textElem.style.textOverflow = "ellipsis";
            textElem.style.userSelect = "none";
            textElem.style.cursor = "help";
            textElem.style.width = "100%";

            wrapper.appendChild(textElem);

            const extraTextElem = document.createElement("div");
            extraTextElem.textContent = `Pseudonym: ${translationKey}`;
            extraTextElem.style.display = "none";
            extraTextElem.style.userSelect = "none";
            extraTextElem.style.cursor = "help";
            extraTextElem.style.fontWeight = "normal";
            extraTextElem.style.fontSize = "1rem";

            wrapper.appendChild(extraTextElem);
            currWrapper = wrapper;
        } else {
            wrapper.style.justifyContent = "start";
            wrapper.appendChild(textElem);

            textElem.style.textDecoration = "underline";
            textElem.title = `Pseudonym: ${translationKey}`;
            textElem.style.cursor = "help";
            textElem.style.userSelect = "none";
        }

        const translationEntry = {
            wrapperElem: wrapper,
            hideElem,
            translationKey,
            shadowRoot: textElem.attachShadow({mode: "closed"}),
            prefix,
            inline
        };

        populateNode(translationEntry);

        return wrapper;
    }

    function evaluateXPath(node, expr) {
        const xpe = new XPathEvaluator();
        const nsResolver = node.ownerDocument?.documentElement ?? node.documentElement;

        if (!nsResolver) return [];

        const result = xpe.evaluate(expr, node, nsResolver, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
        const found = [];
        for (let i = 0; i < result.snapshotLength; i++) found.push(result.snapshotItem(i));

        return found;
    }

    function modifyModal(elem) {
        const baseModalRes = evaluateXPath(elem, "*//form//div[count(*) = 2 and count(div) = 2]/div[count(*) = 2 and count(label)=1 and count(div)=1]/div/div[contains(@class, 'input-container')]");

        if (baseModalRes.length) {
            for (const inputContainer of baseModalRes) {
                const sibling = inputContainer.nextElementSibling;
                if (!sibling || !sibling.classList?.contains("measure-this")) continue;

                const clientPart = sibling.textContent?.split(" / ")[0];
                if (!clientPart) continue;

                const translationNode = createTranslationNode(clientPart.trim(), true);
                if (!translationNode) continue; // prevent eager creation of translation nodes with invalid translation keys

                // create wrapper so as to not overflow original client name
                const newMeasureWrapper = document.createElement("div");
                newMeasureWrapper.classList.add("measure-this");
                newMeasureWrapper.style.overflow = "visible";
                newMeasureWrapper.style.height = "100%";
                newMeasureWrapper.style.display = "flex";
                newMeasureWrapper.style.alignItems = "center";

                const newMeasureSpan = document.createElement("span");
                newMeasureSpan.style.overflow = "hidden";
                newMeasureSpan.style.height = "0px";
                newMeasureSpan.textContent = clientPart;
                newMeasureSpan.innerHTML += "&nbsp;";

                newMeasureWrapper.appendChild(newMeasureSpan);
                newMeasureWrapper.appendChild(translationNode);

                sibling.parentElement.appendChild(newMeasureWrapper);
            }
            return;
        }

        for (const clientEntry of evaluateXPath(elem, "*//form/*/*/div[count(*) = 2 and count(label)=1 and count(span)=1]")) {
            const clientNameSpan = clientEntry.children[1];

            if (clientNameSpan.tagName !== "SPAN") continue;

            const translationNode = createTranslationNode(clientNameSpan.textContent.trim(), false, clientNameSpan);
            if (!translationNode) continue;

            const style = getComputedStyle(clientNameSpan);
            translationNode.style.fontWeight = style.fontWeight;
            translationNode.style.fontSize = style.fontSize;

            clientEntry.appendChild(translationNode);
        }

    }

    function modifyItemWrapper(elem) {
        for (const textEntry of evaluateXPath(elem, '*/*/div[not(*)]')) {
            const translationNode = createTranslationNode(textEntry.textContent.trim(), false, textEntry);
            if (!translationNode) continue;

            const parent = textEntry.parentElement;

            if (textEntry === parent.lastElementChild) parent.appendChild(translationNode);
            else parent.insertBefore(translationNode, textEntry.nextElementSibling);
        }

        for (const compactEntry of evaluateXPath(elem, '*/*/*/div[count(span)>0 and count(*[not(self::span)]) = 0]')) {
            const lastSpan = compactEntry.lastElementChild;
            const lastSpanText = lastSpan.textContent;

            if (!lastSpanText.startsWith(" /")) continue;

            const translationNode = createTranslationNode(lastSpanText.substring(2).trim(), false, lastSpan, "&nbsp;/&nbsp;", true);
            if (!translationNode) continue;

            compactEntry.appendChild(translationNode);
        }
    }

    function modifyTooltip(elem) {
        for (const divContainer of evaluateXPath(elem, '*/div/div[1][count(div) > 0]')) {
            const lastDiv = evaluateXPath(divContainer, '(div)[last()]')[0];
            if (!lastDiv) continue;

            const translationNode = createTranslationNode(lastDiv.textContent.trim(), false, lastDiv);
            if (!translationNode) continue;

            const parent = lastDiv.parentElement;

            if (lastDiv === parent.lastElementChild) parent.appendChild(translationNode);
            else parent.insertBefore(translationNode, lastDiv.nextElementSibling);
        }

        for (const tooltipContainer of evaluateXPath(elem, 'div/div')) {
            tooltipContainer.style.maxWidth = "unset";
        }
    }


    const observer = new MutationObserver(mutationRecords => {
        disconnectObserver(); // prevent fun infinite recursion
        try {
            let modalRes; // only modify modal once per mutation "iteration"
            for (const record of mutationRecords) {
                if (!record.addedNodes) continue;
                for (const addedNode of record.addedNodes) {
                    if (addedNode.classList?.contains("float-ui-modal")) {
                        // console.log("Modifying modal", addedNode);
                        modifyModal(addedNode);
                    } else if (addedNode.classList?.contains("ItemWrapper")) {
                        // console.log("Item wrapper", addedNode);
                        modifyItemWrapper(addedNode);
                    } else if (addedNode.classList?.contains("MainCell-Wrapper")) {
                        // console.log("MainCell wrapper", addedNode);
                        addedNode.querySelectorAll(".ItemWrapper").forEach(modifyItemWrapper);
                    } else if (addedNode.hasAttribute?.("data-radix-popper-content-wrapper")) {
                        // console.log("Tooltip", addedNode);
                        modifyTooltip(addedNode);
                    } else if (!modalRes && (modalRes = addedNode.closest?.(".float-ui-modal"))) {
                        // console.log("Modifying modal (closest path)", modalRes, addedNode);
                        modifyModal(modalRes);
                    } else {
                        // console.log("Unknown", addedNode);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }

        connectObserver();
    });

    function connectObserver() {
        observer.observe(document, {
            childList: true,
            subtree: true
        });
    }

    function disconnectObserver() {
        observer.disconnect();
    }

    connectObserver();
})();