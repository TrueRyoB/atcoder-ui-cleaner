// ==UserScript==
// @name         AtCoder UI Cleaner
// @namespace    https://atcoder.jp/
// @version      1.0.1
// @description  Hide certain UI elements from contest page for the reduced amount of noise. 
// @author       (https://x.com/deep_nap_engine)
// @match        https://atcoder.jp/contests/*
// @grant        none
// @license      MIT
// @homepage     https://github.com/TrueRyoB/atcoder-ui-cleaner/
// @support      https://github.com/TrueRyoB/atcoder-ui-cleaner/issues/

// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────
  // constants
  // ─────────────────────────────────────────

  const STORAGE_KEYS = {
    contest_top: 'atcoder_ui_cleaner:contest_top:enabled',
    task_page:    'atcoder_ui_cleaner:task_page:enabled',
    submission:   'atcoder_ui_cleaner:submission_page:enabled',
    task_list:    'atcoder_ui_cleaner:task_list:enabled',
  };

  const PROCESSED_ATTR = 'data-atcoder-ui-cleaner-hidden';
  const EXCEPTION_CLASS = "ui-atcoder-ui-cleaner-critical";

  // ─────────────────────────────────────────
  // page categorization
  // ─────────────────────────────────────────

  /**
   * @returns {'contest_top' | 'task_page' | 'submission' | 'task_list' | null}
   */
  function detectPageType() {
    const path = location.pathname;

    // submission detail: /contests/******/submissions/xxxxxxxxxx/
    if (/^\/contests\/[^/]+\/submissions\/\d+$/.test(path)) {
      return 'submission';
    }

    // task detail: /contests/******/tasks/******_*/
    if (/^\/contests\/[^/]+\/tasks\/[^/]+$/.test(path)) {
      return 'task_page';
    }

    // problem list: /contests/******/
    if (/^\/contests\/[^/]+\/?$/.test(path)) {
      return 'contest_top';
    }

    // task list: /contests/*******/tasks
    if (/^\/contests\/[^/]+\/tasks\/?$/.test(path)) {
      return 'task_list';
    }

    return null;
  }

  // ─────────────────────────────────────────
  // localStorage helper
  // ─────────────────────────────────────────

  // is set enabled by defualt
  function isEnabled(pageType) {
    const val = localStorage.getItem(STORAGE_KEYS[pageType]);
    return val === null ? true : val === 'true';
  }

  // ─────────────────────────────────────────
  // helper for applying a hidden tag
  // ─────────────────────────────────────────

  function hideElement(el) {
    if (!el || el.hasAttribute(PROCESSED_ATTR) || el.classList.contains(EXCEPTION_CLASS)) return;
    el.style.display = 'none';
    el.setAttribute(PROCESSED_ATTR, '1');
  }

  // ─────────────────────────────────────────
  // helper for a text search
  // ─────────────────────────────────────────

  /**
   * retrives a set of nodes with the certain keyword as its immediate child
   * ...from the entire document
   */
  function findElementsByOwnText(keyword) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const results = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes(keyword)) {
        const parent = node.parentElement;
        if (parent && !results.includes(parent)) {
          results.push(parent);
        }
      }
    }
    return results;
  }

  // ─────────────────────────────────────────
  // 5.1.1 contest top
  // ─────────────────────────────────────────

  function hideContestTopElements() {
    // tageting every <section> tag which is a parent of nodes
    // ...holdinge one of the keywords as a substring
    const keywords = ['点数'];
    keywords.forEach((kw) => {
      const matched = findElementsByOwnText(kw);
      matched.forEach((el) => {
        let cursor = el;
        let minSection = null;
        while (cursor && cursor !== document.body) {
          if (cursor.tagName === 'SECTION') {
            minSection = cursor;
            break;
          }
          cursor = cursor.parentElement;
        }
        if (minSection) {
          hideElement(minSection);
        }
      });
    });

    // and its associated h3 tag (outside of the section)
    const h3tag = findElementsByOwnText('配点');
    h3tag.forEach((el)=>hideElement(el));
  }

  // ─────────────────────────────────────────
  // 5.1.2 task detail
  // ─────────────────────────────────────────

  // hide minimum wrappers with certain information
  function hideTaskPageElements() {
    const targets = ['実行時間制限', 'メモリ制限', '配点'];
    targets.forEach((kw) => {
      const matched = findElementsByOwnText(kw);
      matched.forEach((el) => {
        const wrapper = findMinimalWrapper(el);
        hideElement(wrapper);
      });
    });
  }

  /**
   * retrieves the minimum semantic UI element containing an input element;
   * prioritizes li / p / div / tr / td for a cleaner DOM if they are close enough
   */
  function findMinimalWrapper(el) {
    const blockTags = new Set(['LI', 'P', 'DIV', 'TR', 'TD', 'DT', 'DD', 'SPAN']);
    let cursor = el;
    // explore up to three levels
    for (let i = 0; i < 3; i++) {
      if (!cursor.parentElement || cursor.parentElement === document.body) break;
      const parent = cursor.parentElement;
      if (blockTags.has(parent.tagName)) {
        // take the parent node if it seems not containing 
        // ....other significant information
        const textLength = (parent.textContent || '').trim().length;
        if (textLength < 100) {
          cursor = parent;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return cursor;
  }

  // ─────────────────────────────────────────
  // 5.1.3 submission detail
  // ─────────────────────────────────────────

  function hideSubmissionElements() {
    // hide every subsequent UI element in the same scope
    // ...from and after the label specified
    const h4List = document.querySelectorAll('h4');
    const label = 'ジャッジ結果';
    h4List.forEach((h4) => {
      if (!h4.textContent.includes(label) ||
          h4.hasAttribute(PROCESSED_ATTR) ||
          !h4.parentElement) return;

      let u = h4;
      while(u) {
        hideElement(u);
        u = u.nextElementSibling;
      }
    });
  }

  // ─────────────────────────────────────────
  // 5.1.4 task list
  // ─────────────────────────────────────────
  
  function hideTaskListElements() {
    // hide columns indicating time or memory limit
    const targets = ["実行時間制限", "メモリ制限"];

    const headerRow = document.querySelector('tr');
    if(!headerRow) return;

    const headers = [...headerRow.querySelectorAll('th')];
    
    const hide = [...headerRow.querySelectorAll('th')].map(cell =>
      targets.some(t => cell.textContent === t)
    );

    const rows = document.querySelectorAll('tr');

    rows.forEach(row => {
      row.querySelectorAll('th, td').forEach((cell, i) => {
        if(hide[i]) hideElement(cell);
      })
    })
  }


  // ─────────────────────────────────────────
  // core function called for every redrawal
  // ─────────────────────────────────────────

  function run(pageType) {
    if (!isEnabled(pageType)) return;

    switch (pageType) {
      case 'contest_top':
        hideContestTopElements();
        break;
      case 'task_page':
        hideTaskPageElements();
        break;
      case 'submission':
        hideSubmissionElements();
        break;
      case 'task_list':
        hideTaskListElements();
        break;
    }
  }

  // ─────────────────────────────────────────
  // ui insertion (dropdown and modal)
  // ─────────────────────────────────────────

  function mountUI({
    modalHTML,
    dropdownHTML,
    legacyDropdownHTML,
    modalSelector = "#my-settings-modal",
    rowSelector = ".settings-row",
  }) {
    document.body.insertAdjacentHTML("afterbegin", modalHTML);

    document
      .querySelector(".header-mypage_list li:nth-last-child(1)")
      ?.insertAdjacentHTML("beforebegin", dropdownHTML);

    document
      .querySelector(".navbar-right .dropdown-menu .divider:nth-last-child(2)")
      ?.insertAdjacentHTML("beforebegin", legacyDropdownHTML);

    const modal = document.querySelector(modalSelector);
    if (!modal) throw new Error("modal not found");

    const row = modal.querySelector(rowSelector);
    if (!row) throw new Error("settings row not found");

    return { modal, row };
  }

  function addCheckbox(row, label, checked, description, onChange) {
    const div = document.createElement("div");
    div.className = "checkbox ";

    const labelElem = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;

    labelElem.append(input, label);
    labelElem.classList.add(EXCEPTION_CLASS);

    if (description) {
      const small = document.createElement("div");
      small.className = "small gray";
      small.textContent = description;
      labelElem.append(small);
    }

    div.append(labelElem);
    row.append(div);

    input.addEventListener("change", () => onChange(input.checked));
  }

  const modalTitle="ui-cleaner 表示設定";
  const dropdownLabel="ui-cleaner 設定";

  const { modal, row } = mountUI({
    modalHTML: `
      <div id="my-settings-modal" class="modal fade" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal">x</button>
              <h4 class="modal-title">${modalTitle}</h4>
            </div>
            <div class="modal-body">
              <div class="container-fluid ${EXCEPTION_CLASS}">
                <div class="settings-row"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    dropdownHTML: `<li><a data-toggle="modal" data-target="#my-settings-modal" style="cursor:pointer;"><i class=\"a-icon a-icon-setting\"></i> ${dropdownLabel}</a></li>`,
    legacyDropdownHTML: `<li><a data-toggle="modal" data-target="#my-settings-modal" style="cursor:pointer;"><span class=\"glyphicon glyphicon-wrench\" aria-hidden=\"true\"></span> ${dropdownLabel}</a></li>`,
  });

  addCheckbox(row, "配点", true, "前から順番に解くことを推奨しています", (v) => console.log(v));
  addCheckbox(row, "実行時間制限", true, "2000msを切ることはないでしょう", (v) => console.log(v));
  addCheckbox(row, "メモリ制限", true, "普段通りの実装を心がけましょう", (v) => console.log(v));
  addCheckbox(row, "提出結果詳細", true, "下手な憶測は却って逆効果です", (v) => console.log(v));
  // addCheckbox(row, "問題ラベル", false, "見て呉れに惑わされません", (v) => console.log(v));

  // ─────────────────────────────────────────
  // support for dynamic redrawal, using MutationObserver
  // ─────────────────────────────────────────

  function setupObserver(pageType) {
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        run(pageType);
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ─────────────────────────────────────────
  // entry
  // ─────────────────────────────────────────

  function main() {
    const pageType = detectPageType();
    if (!pageType) return;

    run(pageType);
    setupObserver(pageType);
  }

  // calls main() on DOM load completion
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
