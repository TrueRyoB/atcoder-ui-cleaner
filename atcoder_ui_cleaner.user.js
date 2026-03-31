// ==UserScript==
// @name         AtCoder UI Cleaner
// @namespace    https://atcoder.jp/
// @version      1.0.0
// @description  AtCoderの特定ページで配点・制限・ジャッジ結果などを非表示化するUserScript
// @author       Generated from spec
// @match        https://atcoder.jp/contests/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────
  // constants
  // ─────────────────────────────────────────

  const STORAGE_KEYS = {
    contest_list: 'atcoder_ui_cleaner:contest_list:enabled',
    task_page:    'atcoder_ui_cleaner:task_page:enabled',
    submission:   'atcoder_ui_cleaner:submission_page:enabled',
  };

  const PROCESSED_ATTR = 'data-atcoder-ui-cleaner-hidden';

  // ─────────────────────────────────────────
  // page categorization
  // ─────────────────────────────────────────

  /**
   * @returns {'contest_list' | 'task_page' | 'submission' | null}
   */
  function detectPageType() {
    const path = location.pathname;

    // submission detail: /contests/******/submissions/xxxxxxxxxx
    if (/^\/contests\/[^/]+\/submissions\/\d+$/.test(path)) {
      return 'submission';
    }

    // task detail: /contests/******/tasks/******_*
    if (/^\/contests\/[^/]+\/tasks\/[^/]+$/.test(path)) {
      return 'task_page';
    }

    // problem list: /contests/******
    if (/^\/contests\/[^/]+\/?$/.test(path)) {
      return 'contest_list';
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
    if (!el || el.hasAttribute(PROCESSED_ATTR)) return;
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
  // 5.1.1 contest list
  // ─────────────────────────────────────────

  function hideContestListElements() {
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

  function hideTaskPageElements() {
    const targets = ['実行時間制限', 'メモリ制限', '配点'];
    targets.forEach((kw) => {
      const matched = findElementsByOwnText(kw);
      matched.forEach((el) => {
        // ラベルの最小単位（当該要素そのもの or その直近の li/p/div/tr）を非表示化
        const wrapper = findMinimalWrapper(el);
        hideElement(wrapper);
      });
    });
  }

  /**
   * el を包む最小の意味的ブロック要素を返す。
   * li / p / div / tr / td が近くにある場合はそれを使う。
   * なければ el 自身を返す。
   */
  function findMinimalWrapper(el) {
    const blockTags = new Set(['LI', 'P', 'DIV', 'TR', 'TD', 'DT', 'DD', 'SPAN']);
    let cursor = el;
    // 直親で十分小さいブロックを探す（最大 3 階層まで）
    for (let i = 0; i < 3; i++) {
      if (!cursor.parentElement || cursor.parentElement === document.body) break;
      const parent = cursor.parentElement;
      if (blockTags.has(parent.tagName)) {
        // parent の中にこのキーワード要素以外のコンテンツが多くなければ parent を使う
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
  // 5.1.3 提出詳細ページ
  // ─────────────────────────────────────────

  function hideSubmissionElements() {
    // <h4>ジャッジ結果</h4> を基準点として、同一スコープ内の後続要素をすべて非表示化
    const h4List = document.querySelectorAll('h4');
    h4List.forEach((h4) => {
      if (!h4.textContent.includes('ジャッジ結果')) return;
      if (h4.hasAttribute(PROCESSED_ATTR)) return;

      // h4 の親（scope）内で h4 以降の兄弟要素を非表示化
      const parent = h4.parentElement;
      if (!parent) return;

      // h4 自身も非表示
      hideElement(h4);

      // 同じ親の兄弟でh4より後のものをすべて非表示化
      let sibling = h4.nextElementSibling;
      while (sibling) {
        hideElement(sibling);
        sibling = sibling.nextElementSibling;
      }
    });
  }

  // ─────────────────────────────────────────
  // メイン処理
  // ─────────────────────────────────────────

  function run(pageType) {
    if (!isEnabled(pageType)) return;

    switch (pageType) {
      case 'contest_list':
        hideContestListElements();
        break;
      case 'task_page':
        hideTaskPageElements();
        break;
      case 'submission':
        hideSubmissionElements();
        break;
    }
  }

  // ─────────────────────────────────────────
  // MutationObserver による動的再描画対応
  // ─────────────────────────────────────────

  function setupObserver(pageType) {
    let timer = null;
    const observer = new MutationObserver(() => {
      // デバウンス: 連続した DOM 変化をまとめて処理
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
  // エントリーポイント
  // ─────────────────────────────────────────

  function main() {
    const pageType = detectPageType();
    if (!pageType) return;

    // 初回実行
    run(pageType);

    // 動的変化への対応
    setupObserver(pageType);
  }

  // DOM が準備できていれば即時、なければ DOMContentLoaded 後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
