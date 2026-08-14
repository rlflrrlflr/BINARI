var define_import_meta_env_default = {};
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo } from "react";
import { readImprint } from "./lib/imprint.js";
const AKEY = define_import_meta_env_default.VITE_POSTHOG_KEY;
let _ph = null, _phInit = false;
const PROFILE_KEYS = /* @__PURE__ */ new Set([]);
const stripProfile = (p) => {
  const o = {};
  for (const k in p) if (!PROFILE_KEYS.has(k)) o[k] = p[k];
  return o;
};
const INTERNAL_KEY = "binari.internal.v1";
const FIRSTTOUCH_KEY = "binari.firsttouch.v1";
let _superProps = {};
function _initSuperProps() {
  if (typeof window === "undefined") return;
  let sp;
  try {
    sp = new URLSearchParams(window.location.search);
  } catch (_) {
    sp = new URLSearchParams("");
  }
  const g = (k) => sp.get(k) || null;
  let internal = false;
  try {
    if (g("i") === "1") window.localStorage.setItem(INTERNAL_KEY, "1");
    internal = window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch (_) {
    internal = g("i") === "1";
  }
  let ft = null;
  try {
    ft = JSON.parse(window.localStorage.getItem(FIRSTTOUCH_KEY) || "null");
  } catch (_) {
  }
  if (!ft || !ft.ft_source) {
    ft = {
      ft_source: g("utm_source") || g("ref") || (g("fbclid") ? "meta" : null) || (g("gclid") ? "google" : null) || (g("v") ? "share" : "direct"),
      ft_medium: g("utm_medium"),
      ft_campaign: g("utm_campaign"),
      ft_content: g("utm_content"),
      // 소재 단위 — 이 값이 있어야 소재별 성과가 갈린다
      ft_term: g("utm_term"),
      ft_click: g("fbclid") ? "fbclid" : g("gclid") ? "gclid" : null,
      // 원값 아닌 종류만
      ft_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
    };
    try {
      window.localStorage.setItem(FIRSTTOUCH_KEY, JSON.stringify(ft));
    } catch (_) {
    }
  }
  _superProps = { is_internal: internal, ...ft };
  const b = readBelief();
  if (b) _superProps.belief = b;
}
const CONSENT_KEY = "binari.analytics_consent.v1";
let _consent = false;
function readConsent() {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch (_) {
    return false;
  }
}
function setAnalyticsConsent(on) {
  _consent = !!on;
  try {
    window.localStorage.setItem(CONSENT_KEY, on ? "1" : "0");
  } catch (_) {
  }
  if (on) _initAnalytics();
}
const _q = [];
const Q_MAX = 50;
function _flush() {
  if (!_ph) return;
  while (_q.length) {
    const e = _q.shift();
    try {
      _ph.capture(e.ev, _consent ? e.props : stripProfile(e.props), { timestamp: e.at });
    } catch (_) {
    }
  }
}
async function _initAnalytics() {
  if (_phInit || !AKEY || typeof window === "undefined") return;
  _phInit = true;
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(AKEY, {
      api_host: define_import_meta_env_default.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      // SPA라 무의미
      capture_pageleave: true,
      // 체류시간·바운스율을 잴 유일한 근거. 광고 랜딩 품질 평가에 필수
      capture_exceptions: true,
      // JS 예외 — 없으면 앱이 깨져도 아무도 모른다
      capture_performance: false,
      // $web_vitals 끔 — 전체 기록의 22%를 먹으면서(유저당 11.5건)
      //   성과 분석에도 앱 개선에도 안 쓰였다. 판결 대기시간은
      //   verdict_shown.ms 로 이미 더 직접적으로 재고 있다.
      autocapture: false,
      persistence: "localStorage"
    });
    _ph = posthog;
    try {
      posthog.register(_superProps);
    } catch (_) {
    }
    _flush();
  } catch (_) {
  }
}
const VISIT_KEY = "binari.lastvisit.v1";
const VISIT_GAP_MS = 30 * 60 * 1e3;
function trackVisit(props) {
  let last = 0;
  try {
    last = +(window.localStorage.getItem(VISIT_KEY) || 0) || 0;
  } catch (_) {
  }
  if (Date.now() - last < VISIT_GAP_MS) return false;
  try {
    window.localStorage.setItem(VISIT_KEY, String(Date.now()));
  } catch (_) {
  }
  track("app_open", props);
  return true;
}
function trackVisitOnce(ev, props) {
  const k = "binari.once." + ev;
  try {
    const last = +(window.localStorage.getItem(k) || 0) || 0;
    if (Date.now() - last < VISIT_GAP_MS) return false;
    window.localStorage.setItem(k, String(Date.now()));
  } catch (_) {
  }
  track(ev, props || {});
  return true;
}
function track(ev, props) {
  try {
    const p = { ..._superProps, ...props || {} };
    const out = _consent ? p : stripProfile(p);
    if (_ph) _ph.capture(ev, out);
    else if (_q.length < Q_MAX) _q.push({ ev, props: p, at: /* @__PURE__ */ new Date() });
    if (typeof window !== "undefined" && window.__binariTrackDebug) (window.__binariEvents = window.__binariEvents || []).push({ ev, props: out });
  } catch (_) {
  }
}
if (typeof window !== "undefined" && /[?&]trackdebug/.test(window.location.search)) window.__binariTrackDebug = true;
const BELIEF_KEY = "binari.belief.v1";
function readBelief() {
  try {
    return window.localStorage.getItem(BELIEF_KEY) || "";
  } catch (_) {
    return "";
  }
}
function saveBelief(v) {
  try {
    window.localStorage.setItem(BELIEF_KEY, v);
  } catch (_) {
  }
  _superProps.belief = v;
  if (_ph) {
    try {
      _ph.register({ belief: v });
    } catch (_) {
    }
  }
}
_initSuperProps();
const GAN = ["\uAC11", "\uC744", "\uBCD1", "\uC815", "\uBB34", "\uAE30", "\uACBD", "\uC2E0", "\uC784", "\uACC4"];
const JI = ["\uC790", "\uCD95", "\uC778", "\uBB18", "\uC9C4", "\uC0AC", "\uC624", "\uBBF8", "\uC2E0", "\uC720", "\uC220", "\uD574"];
const GAN_EL = ["\uBAA9", "\uBAA9", "\uD654", "\uD654", "\uD1A0", "\uD1A0", "\uAE08", "\uAE08", "\uC218", "\uC218"];
const JI_EL = ["\uC218", "\uD1A0", "\uBAA9", "\uBAA9", "\uD1A0", "\uD654", "\uD654", "\uD1A0", "\uAE08", "\uAE08", "\uD1A0", "\uC218"];
const EL_READ = {
  \uC218: "\uC0DD\uAC01\uC774 \uAE4A\uACE0 \uB9CE\uC544\uC11C, \uACB0\uC815 \uC55E\uC5D0 \uC624\uB798 \uC11C \uC788\uB294 \uC0AC\uB78C\uC774\uC5C8\uC9C0. \uC54C\uACE0 \uC788\uC5C8\uC5B4.",
  \uD654: "\uB9C8\uC74C\uC5D0 \uBD88\uC774 \uBD99\uC73C\uBA74 \uBABB \uCC38\uB294 \uC0AC\uB78C. \uADF8 \uB728\uAC70\uC6C0\uC774 \uB108\uB97C \uC5EC\uAE30\uAE4C\uC9C0 \uB370\uB824\uC654\uC5B4.",
  \uBAA9: "\uACC4\uC18D \uC790\uB77C\uACE0 \uC2F6\uC5B4\uD558\uB294 \uC0AC\uB78C\uC774\uC57C, \uB108\uB294. \uBA48\uCDB0 \uC788\uC73C\uBA74 \uC2DC\uB4E4\uD574\uC9C0\uB294 \uAC78 \uB0B4\uAC00 \uBD24\uC5B4.",
  \uAE08: "\uD55C\uBC88 \uC815\uD558\uBA74 \uB2E8\uB2E8\uD55C \uC0AC\uB78C. \uB300\uC2E0 \uC815\uD558\uAE30\uAE4C\uC9C0\uAC00 \uC624\uB798 \uAC78\uB9AC\uB294 \uAC83\uB3C4 \uC54C\uC544.",
  \uD1A0: "\uC8FC\uBCC0\uC744 \uBC1B\uCCD0\uC8FC\uB290\uB77C \uC815\uC791 \uB124 \uACB0\uC815\uC740 \uB4A4\uB85C \uBBF8\uB8E8\uB294 \uC0AC\uB78C\uC774\uC5C8\uC9C0."
};
const jdn = (y, m, d) => {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
function sunLongitude(jdUT) {
  const T = (jdUT - 2451545) / 36525;
  const L0 = (280.46646 + 36000.76983 * T + 3032e-7 * T * T) % 360;
  const M = 357.52911 + 35999.05029 * T - 1537e-7 * T * T;
  const Mr = M * Math.PI / 180;
  const C = (1.914602 - 4817e-6 * T - 14e-6 * T * T) * Math.sin(Mr) + (0.019993 - 101e-6 * T) * Math.sin(2 * Mr) + 289e-6 * Math.sin(3 * Mr);
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 569e-5 - 478e-5 * Math.sin(omega * Math.PI / 180);
  return (lambda % 360 + 360) % 360;
}
function equationOfTime(jdUT) {
  const T = (jdUT - 2451545) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360 * Math.PI / 180;
  const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
  const e = 0.016708634 - 42037e-9 * T;
  const eps = (23.43929 - 0.01300417 * T) * Math.PI / 180;
  const y2 = Math.tan(eps / 2) ** 2;
  const E = y2 * Math.sin(2 * L0) - 2 * e * Math.sin(M) + 4 * e * y2 * Math.sin(M) * Math.cos(2 * L0) - 0.5 * y2 * y2 * Math.sin(4 * L0) - 1.25 * e * e * Math.sin(2 * M);
  return E * 4 * 180 / Math.PI;
}
function moonLongitude(jdUT) {
  const T = (jdUT - 2451545) / 36525, d = Math.PI / 180;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const lon = Lp + 6.288774 * Math.sin(Mp * d) + 1.274027 * Math.sin((2 * D - Mp) * d) + 0.658314 * Math.sin(2 * D * d) + 0.213618 * Math.sin(2 * Mp * d) - 0.185116 * Math.sin(M * d) - 0.114332 * Math.sin(2 * F * d) + 0.058793 * Math.sin((2 * D - 2 * Mp) * d) + 0.057066 * Math.sin((2 * D - M - Mp) * d) + 0.053322 * Math.sin((2 * D + Mp) * d) + 0.045758 * Math.sin((2 * D - M) * d);
  return (lon % 360 + 360) % 360;
}
const ZODIAC12 = ["\uC591\uC790\uB9AC", "\uD669\uC18C\uC790\uB9AC", "\uC30D\uB465\uC774\uC790\uB9AC", "\uAC8C\uC790\uB9AC", "\uC0AC\uC790\uC790\uB9AC", "\uCC98\uB140\uC790\uB9AC", "\uCC9C\uCE6D\uC790\uB9AC", "\uC804\uAC08\uC790\uB9AC", "\uC0AC\uC218\uC790\uB9AC", "\uC5FC\uC18C\uC790\uB9AC", "\uBB3C\uBCD1\uC790\uB9AC", "\uBB3C\uACE0\uAE30\uC790\uB9AC"];
const NAKSHATRA = ["\uC544\uC288\uC704\uB2C8", "\uBC14\uB77C\uB2C8", "\uD06C\uB9AC\uD2F0\uCE74", "\uB85C\uD788\uB2C8", "\uBBC0\uB9AC\uAC00\uC2DC\uB77C", "\uC544\uB974\uB4DC\uB77C", "\uD478\uB098\uB974\uBC14\uC218", "\uD478\uC26C\uC57C", "\uC544\uC290\uB808\uC0E4", "\uB9C8\uAC00", "\uD478\uB974\uBC14\uD314\uAD6C\uB2C8", "\uC6B0\uD0C0\uB77C\uD314\uAD6C\uB2C8", "\uD558\uC2A4\uD0C0", "\uCE58\uD2B8\uB77C", "\uC2A4\uC640\uD2F0", "\uBE44\uC0E4\uCE74", "\uC544\uB204\uB77C\uB2E4", "\uC81C\uC288\uD0C0", "\uBB3C\uB77C", "\uD478\uB974\uBC14\uC0E4\uB2E4", "\uC6B0\uD0C0\uB77C\uC0E4\uB2E4", "\uC288\uB77C\uBC14\uB098", "\uB2E4\uB2C8\uC288\uD0C0", "\uC0E4\uD0C0\uBE44\uC0E4", "\uD478\uB974\uBC14\uBC14\uB4DC\uB77C", "\uC6B0\uD0C0\uB77C\uBC14\uB4DC\uB77C", "\uB808\uBC14\uD2F0"];
function moonPlacements(y, m, dd, h, mi, hourUnknown) {
  const jdB = jdFromKST(y, m, dd, hourUnknown ? 12 : h, hourUnknown ? 0 : mi || 0);
  const lon = moonLongitude(jdB);
  const ayan = 23.86 + (y - 1990) * 0.01397;
  const sid = ((lon - ayan) % 360 + 360) % 360;
  return { moonSign: ZODIAC12[Math.floor(lon / 30) % 12], nakshatra: NAKSHATRA[Math.floor(sid / (360 / 27)) % 27], lon };
}
const TZ_SIGNS = ["\uC774\uBBF9\uC2A4(\uC545\uC5B4)", "\uC774\uD06C(\uBC14\uB78C)", "\uC544\uD06C\uBC1C(\uBC24)", "\uCE78(\uC528\uC557)", "\uCE58\uCE78(\uBC40)", "\uD0A4\uBBF8(\uC804\uD658)", "\uB9C8\uB2C8\uD06C(\uC0AC\uC2B4)", "\uB77C\uB9C8\uD2B8(\uBCC4)", "\uBB3C\uB8E8\uD06C(\uBB3C)", "\uC624\uD06C(\uAC1C)", "\uCD94\uC5D4(\uC6D0\uC22D\uC774)", "\uC5D0\uBE0C(\uAE38)", "\uBCA4(\uAC08\uB300)", "\uC774\uC2DC(\uC7AC\uADDC\uC5B4)", "\uBA58(\uB3C5\uC218\uB9AC)", "\uD0A4\uBE0C(\uC9C0\uD61C)", "\uCE74\uBC18(\uB300\uC9C0)", "\uC5D0\uCE20\uB0A9(\uBD80\uC2EF\uB3CC)", "\uCE74\uC6B0\uC545(\uD3ED\uD48D)", "\uC544\uD558\uC6B0(\uD0DC\uC591)"];
function tzolkin(jd) {
  const n = jd - 584283;
  return { tone: ((n + 3) % 13 + 13) % 13 + 1, sign: TZ_SIGNS[((n + 19) % 20 + 20) % 20] };
}
const NAYIN = ["\uD574\uC911\uAE08\xB7\uBC14\uB2E4 \uC18D\uC758 \uAE08", "\uB178\uC911\uD654\xB7\uD654\uB85C \uC18D\uC758 \uBD88", "\uB300\uB9BC\uBAA9\xB7\uD070 \uC232\uC758 \uB098\uBB34", "\uB178\uBC29\uD1A0\xB7\uAE38\uAC00\uC758 \uD759", "\uAC80\uBD09\uAE08\xB7\uCE7C\uB05D\uC758 \uAE08", "\uC0B0\uB450\uD654\xB7\uC0B0\uBA38\uB9AC\uC758 \uBD88", "\uAC04\uD558\uC218\xB7\uACE8\uC9DC\uAE30\uC758 \uBB3C", "\uC131\uB450\uD1A0\xB7\uC131\uBCBD \uC704\uC758 \uD759", "\uBC31\uB78D\uAE08\xB7\uBC31\uB78D\uC758 \uAE08", "\uC591\uB958\uBAA9\xB7\uBC84\uB4DC\uB098\uBB34", "\uCC9C\uC911\uC218\xB7\uC0D8 \uC18D\uC758 \uBB3C", "\uC625\uC0C1\uD1A0\xB7\uC9C0\uBD95 \uC704\uC758 \uD759", "\uBCBD\uB825\uD654\xB7\uBCBC\uB77D\uC758 \uBD88", "\uC1A1\uBC31\uBAA9\xB7\uC18C\uB098\uBB34\uC640 \uC7A3\uB098\uBB34", "\uC7A5\uB958\uC218\xB7\uAE38\uAC8C \uD750\uB974\uB294 \uBB3C", "\uC0AC\uC911\uAE08\xB7\uBAA8\uB798 \uC18D\uC758 \uAE08", "\uC0B0\uD558\uD654\xB7\uC0B0 \uC544\uB798\uC758 \uBD88", "\uD3C9\uC9C0\uBAA9\xB7\uB4E4\uD310\uC758 \uB098\uBB34", "\uBCBD\uC0C1\uD1A0\xB7\uB2F4\uBCBC\uB77D\uC758 \uD759", "\uAE08\uBC15\uAE08\xB7\uAE08\uBC15\uC758 \uAE08", "\uBCF5\uB4F1\uD654\xB7\uB4F1\uBD88\uC758 \uBD88", "\uCC9C\uD558\uC218\xB7\uC740\uD558\uC758 \uBB3C", "\uB300\uC5ED\uD1A0\xB7\uD070 \uC5ED\uCC38\uC758 \uD759", "\uCC28\uCC9C\uAE08\xB7\uBE44\uB140\uC758 \uAE08", "\uC0C1\uC790\uBAA9\xB7\uBF55\uB098\uBB34", "\uB300\uACC4\uC218\xB7\uD070 \uC2DC\uB0B4\uC758 \uBB3C", "\uC0AC\uC911\uD1A0\xB7\uBAA8\uB798 \uC18D\uC758 \uD759", "\uCC9C\uC0C1\uD654\xB7\uD558\uB298 \uC704\uC758 \uBD88", "\uC11D\uB958\uBAA9\xB7\uC11D\uB958\uB098\uBB34", "\uB300\uD574\uC218\xB7\uD070 \uBC14\uB2E4\uC758 \uBB3C"];
const CITY_LON = {
  \uC11C\uC6B8: 126.978,
  \uC778\uCC9C: 126.71,
  \uC218\uC6D0: 127.03,
  \uC131\uB0A8: 127.14,
  \uACE0\uC591: 126.84,
  \uBD80\uCC9C: 126.78,
  \uC548\uC591: 126.95,
  \uC6A9\uC778: 127.18,
  \uBD80\uC0B0: 129.08,
  \uB300\uAD6C: 128.6,
  \uB300\uC804: 127.38,
  \uAD11\uC8FC: 126.85,
  \uC6B8\uC0B0: 129.31,
  \uC138\uC885: 127.29,
  \uCC3D\uC6D0: 128.68,
  \uAE40\uD574: 128.88,
  \uD3EC\uD56D: 129.36,
  \uC804\uC8FC: 127.15,
  \uCCAD\uC8FC: 127.49,
  \uCC9C\uC548: 127.15,
  \uCD98\uCC9C: 127.73,
  \uC6D0\uC8FC: 127.95,
  \uAC15\uB989: 128.9,
  \uC81C\uC8FC: 126.53,
  \uC11C\uADC0\uD3EC: 126.56
};
function cityLon(city) {
  if (!city) return 126.978;
  for (const k in CITY_LON) if (city.includes(k)) return CITY_LON[k];
  return 126.978;
}
const CITY_LAT = {
  \uC11C\uC6B8: 37.566,
  \uC778\uCC9C: 37.456,
  \uC218\uC6D0: 37.263,
  \uC131\uB0A8: 37.42,
  \uACE0\uC591: 37.658,
  \uBD80\uCC9C: 37.503,
  \uC548\uC591: 37.394,
  \uC6A9\uC778: 37.241,
  \uBD80\uC0B0: 35.18,
  \uB300\uAD6C: 35.872,
  \uB300\uC804: 36.35,
  \uAD11\uC8FC: 35.16,
  \uC6B8\uC0B0: 35.539,
  \uC138\uC885: 36.48,
  \uCC3D\uC6D0: 35.228,
  \uAE40\uD574: 35.229,
  \uD3EC\uD56D: 36.019,
  \uC804\uC8FC: 35.824,
  \uCCAD\uC8FC: 36.642,
  \uCC9C\uC548: 36.815,
  \uCD98\uCC9C: 37.881,
  \uC6D0\uC8FC: 37.342,
  \uAC15\uB989: 37.752,
  \uC81C\uC8FC: 33.499,
  \uC11C\uADC0\uD3EC: 33.254
};
function cityLat(city) {
  if (!city) return 37.5665;
  for (const k in CITY_LAT) if (city.includes(k)) return CITY_LAT[k];
  return 37.5665;
}
const jdFromKST = (y, m, d, h, mi) => jdn(y, m, d) - 0.5 + (h + mi / 60 - 9) / 24;
function calcSaju(y, m, d, h, mi, hourUnknown, lon = 126.978) {
  const jdBirth = jdFromKST(y, m, d, hourUnknown ? 12 : h, hourUnknown ? 0 : mi || 0);
  const lam = sunLongitude(jdBirth);
  const beforeIpchun = m <= 2 && !(lam >= 315);
  const sy = beforeIpchun ? y - 1 : y;
  const yG = (sy - 4) % 10 < 0 ? (sy - 4) % 10 + 10 : (sy - 4) % 10;
  const yJ = (sy - 4) % 12 < 0 ? (sy - 4) % 12 + 12 : (sy - 4) % 12;
  const mn = Math.floor((lam - 315 + 360) % 360 / 30) + 1;
  const mJ = (mn + 1) % 12;
  const mG = (yG % 5 * 2 + 2 + (mn - 1)) % 10;
  const g = (jdn(y, m, d) + 49) % 60;
  const dG = g % 10, dJ = g % 12;
  let hG = null, hJ = null, tstAdj = null;
  if (!hourUnknown) {
    tstAdj = Math.round((lon - 135) * 4 + equationOfTime(jdBirth));
    const tst = h + (mi || 0) / 60 + tstAdj / 60;
    hJ = Math.floor(((tst + 1) % 24 + 24) % 24 / 2);
    hG = (dG % 5 * 2 + hJ) % 10;
  }
  const cnt = { \uBAA9: 0, \uD654: 0, \uD1A0: 0, \uAE08: 0, \uC218: 0 };
  [[yG, yJ], [mG, mJ], [dG, dJ], ...hG !== null ? [[hG, hJ]] : []].forEach(([gg, jj]) => {
    cnt[GAN_EL[gg]]++;
    cnt[JI_EL[jj]]++;
  });
  const main = GAN_EL[dG];
  return {
    pillars: { \uB144: GAN[yG] + JI[yJ], \uC6D4: GAN[mG] + JI[mJ], \uC77C: GAN[dG] + JI[dJ], \uC2DC: hG !== null ? GAN[hG] + JI[hJ] : "\uBBF8\uC0C1" },
    counts: cnt,
    main,
    dayGan: GAN[dG],
    yJ,
    tstAdj,
    idx: { yG, yJ, mG, mJ, dG, dJ, hG, hJ },
    // v101: 십성·신살·택일·세운 계산용 원 인덱스
    nayin: NAYIN[Math.floor(((sy - 4) % 60 + 60) % 60 / 2)]
    // v22: 납음오행
  };
}
const JI_BONGI = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
const SAENG = { \uBAA9: "\uD654", \uD654: "\uD1A0", \uD1A0: "\uAE08", \uAE08: "\uC218", \uC218: "\uBAA9" };
const GEUK = { \uBAA9: "\uD1A0", \uD654: "\uAE08", \uD1A0: "\uC218", \uAE08: "\uBAA9", \uC218: "\uD654" };
function sipseong(dg, tg) {
  const me = GAN_EL[dg], ta = GAN_EL[tg], same = dg % 2 === tg % 2;
  if (me === ta) return same ? "\uBE44\uACAC" : "\uAC81\uC7AC";
  if (SAENG[me] === ta) return same ? "\uC2DD\uC2E0" : "\uC0C1\uAD00";
  if (GEUK[me] === ta) return same ? "\uD3B8\uC7AC" : "\uC815\uC7AC";
  if (GEUK[ta] === me) return same ? "\uD3B8\uAD00" : "\uC815\uAD00";
  return same ? "\uD3B8\uC778" : "\uC815\uC778";
}
function sipseongDist(idx) {
  const out = {};
  const put = (g) => {
    const t = sipseong(idx.dG, g);
    out[t] = (out[t] || 0) + 1;
  };
  [idx.yG, idx.mG].forEach(put);
  if (idx.hG != null) put(idx.hG);
  [idx.yJ, idx.mJ, idx.dJ].forEach((j) => put(JI_BONGI[j]));
  if (idx.hJ != null) put(JI_BONGI[idx.hJ]);
  return out;
}
const EL_USE = {
  // 오행별 실생활 대응 — 색·방위·소리(작명). 통설이며 유파 차이가 없는 부분만 담는다
  \uBAA9: { color: "\uCCAD\uB85D\xB7\uCD08\uB85D", dir: "\uB3D9\uCABD", sound: "\u3131\xB7\u314B" },
  \uD654: { color: "\uBD89\uC740\uC0C9", dir: "\uB0A8\uCABD", sound: "\u3134\xB7\u3137\xB7\u3139\xB7\u314C" },
  \uD1A0: { color: "\uB178\uB791\xB7\uD669\uD1A0", dir: "\uC911\uC559", sound: "\u3147\xB7\u314E" },
  \uAE08: { color: "\uD770\uC0C9", dir: "\uC11C\uCABD", sound: "\u3145\xB7\u3148\xB7\u314A" },
  \uC218: { color: "\uAC80\uC815\xB7\uB0A8\uC0C9", dir: "\uBD81\uCABD", sound: "\u3141\xB7\u3142\xB7\u314D" }
};
const SUMMER = [5, 6, 7], WINTER = [11, 0, 1];
function yongsin(idx, counts, strength) {
  const me = GAN_EL[idx.dG];
  const inseong = Object.keys(SAENG).find((k) => SAENG[k] === me);
  const sikssang = SAENG[me], jaeseong = GEUK[me];
  const gwanseong = Object.keys(GEUK).find((k) => GEUK[k] === me);
  const eokbu = strength === "\uC2E0\uC57D" ? [inseong, me] : strength === "\uC2E0\uAC15" ? [sikssang, jaeseong, gwanseong] : [];
  let johu = [], season = null;
  if (SUMMER.includes(idx.mJ)) {
    season = "\uC5EC\uB984";
    if ((counts.\uD654 || 0) >= 3) johu = ["\uC218", "\uAE08"];
  } else if (WINTER.includes(idx.mJ)) {
    season = "\uACA8\uC6B8";
    if ((counts.\uC218 || 0) >= 3) johu = ["\uD654", "\uBAA9"];
  }
  const agree = johu.length > 0 && eokbu.length > 0 && johu.some((e) => eokbu.includes(e));
  return { eokbu, johu, season, agree, me };
}
const SS_TIP = {
  \uC815\uC7AC: { e: "\uAFB8\uC900\uD788 \uB4E4\uC5B4\uC640 \uC313\uC774\uB294 \uC7AC\uBB3C", r: "\uC6D4\uAE09\xB7\uACC4\uC57D\uCC98\uB7FC \uC608\uCE21\uB418\uB294 \uC218\uC785\uC774 \uBD99\uACE0, \uC0B4\uB9BC\uC744 \uC9C1\uC811 \uC950\uACE0 \uAD74\uB9B0\uB2E4", s: "\uD655\uC2E4\uD55C \uAC83\uB9CC \uC887\uB2E4 \uD310\uC774 \uD070 \uAE30\uD68C\uB97C \uB193\uCE5C\uB2E4" },
  \uD3B8\uC7AC: { e: "\uD06C\uAC8C \uB4E4\uC5B4\uC624\uACE0 \uD06C\uAC8C \uB098\uAC00\uB294 \uC7AC\uBB3C \u2014 \uC0AC\uC5C5 \uCABD \uB3C8", r: "\uD310\uC744 \uBC8C\uC5EC \uD55C \uBC88\uC5D0 \uD06C\uAC8C \uB9CC\uC9C0\uACE0, \uC0AC\uB78C\xB7\uC815\uBCF4\uB85C \uB3C8\uC744 \uB9CC\uB4E0\uB2E4", s: "\uB4E4\uC5B4\uC628 \uB9CC\uD07C \uB098\uAC04\uB2E4. \uC9C0\uD0A4\uB294 \uC7A5\uCE58\uAC00 \uC5C6\uC73C\uBA74 \uB0A8\uB294 \uAC8C \uC5C6\uB2E4" },
  \uC2DD\uC2E0: { e: "\uBA39\uACE0\uC0AC\uB294 \uBCF5\uACFC \uD45C\uD604\uD558\uB294 \uC7AC\uB2A5", r: "\uC190\uC5D0 \uC775\uC740 \uAC78\uB85C \uC624\uB798 \uBC8C\uC5B4\uBA39\uACE0, \uC8FC\uBCC0\uC744 \uD3B8\uD558\uAC8C \uB9CC\uB4E0\uB2E4", s: "\uD3B8\uD55C \uC790\uB9AC\uC5D0 \uBA38\uBB3C\uB7EC \uC2B9\uBD80\uB97C \uBBF8\uB8EC\uB2E4" },
  \uC0C1\uAD00: { e: "\uD2C0\uC744 \uAE68\uB294 \uB9D0\xB7\uCC3D\uC791\uC758 \uC7AC\uB2A5", r: "\uB0A8\uC774 \uBABB \uBCF4\uB294 \uAC78 \uC9DA\uC5B4\uB0B4\uACE0 \uB9D0\xB7\uAE00\xB7\uC190\uC73C\uB85C \uD2F0\uAC00 \uB09C\uB2E4", s: "\uC717\uC0AC\uB78C\xB7\uADDC\uCE59\uACFC \uBD80\uB52A\uD78C\uB2E4. \uC633\uC740 \uB9D0\uC774 \uC190\uD574\uB85C \uB3CC\uC544\uC628\uB2E4" },
  \uC815\uAD00: { e: "\uBA85\uC608\uC640 \uC870\uC9C1 \u2014 \uC790\uB9AC\uAC00 \uB530\uB974\uB294 \uD798", r: "\uB9E1\uAE30\uBA74 \uB05D\uAE4C\uC9C0 \uD558\uACE0, \uC870\uC9C1 \uC548\uC5D0\uC11C \uC774\uB984\uC774 \uC120\uB2E4", s: "\uB0A8\uC758 \uB208\uC774 \uBA3C\uC800 \uBCF4\uC5EC \uC81C \uACB0\uC815\uC744 \uB2A6\uCD98\uB2E4" },
  \uD3B8\uAD00: { e: "\uC2B9\uBD80\uC218\uC640 \uBC84\uD2F0\uB294 \uD798", r: "\uBAB0\uB9B4\uC218\uB85D \uD798\uC774 \uB098\uACE0, \uB0A8\uB4E4\uC774 \uBABB \uACAC\uB514\uB294 \uC790\uB9AC\uB97C \uACAC\uB518\uB2E4", s: "\uAE34\uC7A5\uC744 \uC2A4\uC2A4\uB85C \uB9CC\uB4E0\uB2E4. \uC274 \uC904 \uBAB0\uB77C \uBAB8\uC774 \uBA3C\uC800 \uAEBE\uC778\uB2E4" },
  \uC815\uC778: { e: "\uBC30\uC6C0\xB7\uBB38\uC11C\xB7\uADC0\uC778\uC758 \uBCF5", r: "\uBC30\uC6CC\uC11C \uD478\uB294 \uC77C\uC774 \uB9DE\uACE0, \uC5B4\uB978\xB7\uBB38\uC11C\uAC00 \uB3C4\uC640\uC900\uB2E4", s: "\uC900\uBE44\uB9CC \uAE38\uC5B4\uC9C4\uB2E4. \uC2DC\uC791 \uC804\uC5D0 \uC9C0\uCE5C\uB2E4" },
  \uD3B8\uC778: { e: "\uB0A8\uB2E4\uB978 \uBC1C\uC0C1 \u2014 \uD55C \uC6B0\uBB3C \uD30C\uB294 \uD798", r: "\uAD00\uC2EC \uAC04 \uB370\uB97C \uB05D\uAE4C\uC9C0 \uD30C\uACE0 \uB0A8\uACFC \uB2E4\uB978 \uAE38\uC744 \uB0B8\uB2E4", s: "\uD63C\uC790 \uAE4A\uC5B4\uC9C0\uB2E4 \uC0AC\uB78C\uACFC \uBA40\uC5B4\uC9C4\uB2E4" },
  \uBE44\uACAC: { e: "\uAC19\uC774 \uAC08 \uB3D9\uB8CC\uC758 \uBCF5", r: "\uC81C \uD798\uC73C\uB85C \uBC00\uACE0, \uB73B \uB9DE\uB294 \uC0AC\uB78C\uC774 \uC606\uC5D0 \uBD99\uB294\uB2E4", s: "\uBB3B\uC9C0 \uC54A\uACE0 \uBC00\uC5B4\uBD99\uC778\uB2E4. \uB098\uB20C \uB54C \uBAAB\uC774 \uC900\uB2E4" },
  \uAC81\uC7AC: { e: "\uACBD\uC7C1 \uC18D\uC5D0\uC11C \uD06C\uB294 \uD798", r: "\uB77C\uC774\uBC8C\uC774 \uC788\uC5B4\uC57C \uC2E4\uB825\uC774 \uC624\uB974\uACE0, \uD310\uC774 \uC140\uC218\uB85D \uC0B4\uC544\uB09C\uB2E4", s: "\uB3C8\uACFC \uC0AC\uB78C\uC774 \uC0C8\uAE30 \uC27D\uB2E4. \uBCF4\uC99D\xB7\uB3D9\uC5C5\uC740 \uD2B9\uD788" }
};
const AMROK = [11, 10, 8, 7, 8, 7, 5, 4, 2, 1];
const CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]];
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
const SAMHAP_G = [1, 2, 0, 3];
const YEOKMA = [8, 2, 11, 5], DOHWA = [3, 9, 6, 0], HWAGAE = [10, 4, 1, 7];
function sinsalOf(idx) {
  const jis = [idx.yJ, idx.mJ, idx.dJ, ...idx.hJ != null ? [idx.hJ] : []];
  const has = (t) => jis.includes(t);
  const found = [];
  if (has(AMROK[idx.dG])) found.push({ name: "\uC554\uB85D(\u6697\u797F)", tip: "\uAC89\uC73C\uB85C \uC548 \uB4DC\uB7EC\uB098\uB294 \uBCF5 \u2014 \uB9C9\uD790 \uB54C \uC0AC\uB78C\uC774 \uB098\uD0C0\uB098 \uB6AB\uB824" });
  if (CHEONEUL[idx.dG].some(has)) found.push({ name: "\uCC9C\uC744\uADC0\uC778", tip: "\uD558\uB298\uC774 \uBD99\uC5EC\uC900 \uADC0\uC778 \u2014 \uC5B4\uB824\uC6B8\uC218\uB85D \uB3D5\uB294 \uC190\uC774 \uC640" });
  if (has(MUNCHANG[idx.dG])) found.push({ name: "\uBB38\uCC3D\uADC0\uC778", tip: "\uAE00\uACFC \uBC30\uC6C0\uC758 \uBCF5 \u2014 \uBA38\uB9AC\uB85C \uD478\uB294 \uC77C\uC774 \uB9DE\uC544" });
  for (const g of /* @__PURE__ */ new Set([SAMHAP_G[idx.yJ % 4], SAMHAP_G[idx.dJ % 4]])) {
    if (has(YEOKMA[g]) && !found.some((f) => f.name === "\uC5ED\uB9C8")) found.push({ name: "\uC5ED\uB9C8", tip: "\uC6C0\uC9C1\uC5EC\uC57C \uC5F4\uB9AC\uB294 \uC6B4 \u2014 \uC774\uB3D9\xB7\uCD9C\uC7A5\xB7\uD574\uC678" });
    if (has(DOHWA[g]) && !found.some((f) => f.name === "\uB3C4\uD654")) found.push({ name: "\uB3C4\uD654", tip: "\uC0AC\uB78C\uC744 \uB044\uB294 \uB9E4\uB825 \u2014 \uC778\uAE30\uAC00 \uC7AC\uC0B0\uC774 \uB418\uB294 \uC790\uB9AC" });
    if (has(HWAGAE[g]) && !found.some((f) => f.name === "\uD654\uAC1C")) found.push({ name: "\uD654\uAC1C", tip: "\uD640\uB85C \uAE4A\uC5B4\uC9C0\uB294 \uD798 \u2014 \uC608\uC220\xB7\uACF5\uBD80\xB7\uC218\uD589" });
  }
  return found;
}
const TTI = ["\uC950", "\uC18C", "\uD638\uB791\uC774", "\uD1A0\uB07C", "\uC6A9", "\uBC40", "\uB9D0", "\uC591", "\uC6D0\uC22D\uC774", "\uB2ED", "\uAC1C", "\uB3FC\uC9C0"];
const WONJIN = [7, 6, 9, 8, 11, 10, 1, 0, 3, 2, 5, 4];
const YUKHAP = [1, 0, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
function seun(dg, fromYear, n = 5) {
  const out = [];
  for (let y = fromYear; y < fromYear + n; y++) {
    const t = ((y - 4) % 60 + 60) % 60;
    out.push({ year: y, ganji: GAN[t % 10] + JI[t % 12], ss: sipseong(dg, t % 10) });
  }
  return out;
}
function taekil(idx, from, days = 30) {
  const good = [], bad = [];
  for (let k = 1; k <= days; k++) {
    const t = new Date(from.getTime() + k * 864e5);
    const g = (jdn(t.getFullYear(), t.getMonth() + 1, t.getDate()) + 49) % 60;
    const dj = g % 12, label = t.getMonth() + 1 + "/" + t.getDate();
    if (dj === (idx.dJ + 6) % 12) {
      bad.push({ label, why: "\uC77C\uC9C0\uC640 \uCDA9\uD558\uB294 \uB0A0" });
      continue;
    }
    const why = [];
    if (dj === AMROK[idx.dG]) why.push("\uC554\uB85D\uC77C");
    if (CHEONEUL[idx.dG].includes(dj)) why.push("\uADC0\uC778\uC77C");
    if (dj === YUKHAP[idx.dJ]) why.push("\uC77C\uC9C0\uC640 \uD569\uD558\uB294 \uB0A0");
    if (why.length) good.push({ label, why: why.join("\xB7") });
  }
  return { good: good.slice(0, 3), bad: bad.slice(0, 2) };
}
const JOB_EL = { \uAE08: "\uAE08\uC18D\xB7\uAE30\uACC4\xB7\uAC74\uC124\uC7A5\uBE44\xB7\uADC0\uAE08\uC18D\xB7\uC815\uBC00\xB7\uC758\uB8CC\uAE30\uAE30\xB7\uBC95\uC870 \u2014 \uC1E0 \uC18C\uB9AC \uB098\uB294 \uC77C", \uBAA9: "\uAD50\uC721\xB7\uCD9C\uD310\xB7\uBAA9\uC7AC\xB7\uC12C\uC720\xB7\uAE30\uD68D", \uC218: "\uC720\uD1B5\xB7\uBB34\uC5ED\xB7\uC218\uC0B0\xB7\uC815\uBCF4\xB7\uBB3C\uB958", \uD654: "\uC804\uAE30\xB7\uC804\uC790\xB7\uBBF8\uB514\uC5B4\xB7\uC870\uBA85\xB7\uC694\uC2DD", \uD1A0: "\uBD80\uB3D9\uC0B0\xB7\uAC74\uCD95\xB7\uB18D\uC5C5\xB7\uC911\uAC1C\xB7\uCEE8\uC124\uD305" };
function myeongsikText(saju, sex, now) {
  const idx = saju && saju.idx;
  if (!idx) return "";
  const dist = Object.entries(sipseongDist(idx)).sort((a, b) => b[1] - a[1]);
  const sins = sinsalOf(idx);
  const se = seun(idx.dG, now.getFullYear(), 5);
  const tk = taekil(idx, now);
  const maxEl = Object.entries(saju.counts).sort((a, b) => b[1] - a[1])[0][0];
  return "\n[\uC544\uB798\uB294 \uB124 \uACC4\uC0B0\xB7\uCD94\uB860\uC6A9 \uC790\uB8CC\uB2E4. \uC6A9\uC5B4\uB97C \uBCF8\uBB38\uC5D0 \uADF8\uB300\uB85C \uC4F0\uC9C0 \uB9C8\uB77C \u2014 \uC9C0\uC2DC\uC11C\uC758 [\uC6A9\uC5B4 \uAE08\uC9C0] \uCC38\uC870]\n\uC2ED\uC131 \uBD84\uD3EC(\uC77C\uAC04 " + GAN[idx.dG] + " \uAE30\uC900): " + dist.map(([k, v]) => k + " " + v).join(" \xB7 ") + (sex ? "" : " \u2014 \uC131\uBCC4 \uBBF8\uC785\uB825: \uC790\uC2DD\uC6B4 \uB4F1 \uB0A8\uB140 \uAD6C\uBD84 \uD574\uC11D\uC740 \uB9D0\uD558\uC9C0 \uC54A\uB294\uB2E4") + "\n\uC2E0\uC0B4: " + (sins.length ? sins.map((x) => x.name).join(" \xB7 ") : "\uB450\uB4DC\uB7EC\uC9C4 \uAC83 \uC5C6\uC74C") + "\n\uC138\uC6B4(\uD5A5\uD6C4 5\uB144 \xB7 \uB9AC\uD3EC\uD2B8 \uBC30\uACBD \uC804\uC6A9, \uD310\uACB0\uC758 \uC2DC\uACC4\uB85C \uC4F0\uC9C0 \uB9D0 \uAC83): " + se.map((x) => x.year + " " + x.ganji + "(" + x.ss + ")").join(" / ") + "\n\uB760 \uC778\uC5F0(\uC815\uBCF4 \uC81C\uC2DC\uAE4C\uC9C0\uB9CC \u2014 \uD310\uACB0 \uADFC\uAC70 \uC544\uB2D8): \uCDA9 " + TTI[(idx.yJ + 6) % 12] + "\uB760 \xB7 \uC6D0\uC9C4 " + TTI[WONJIN[idx.yJ]] + "\uB760 \u2014 \uD070\uB3C8\xB7\uBCF4\uC99D\uC740 \uC2E0\uC911\uD788" + (tk.good.length ? "\n\uAE38\uC77C(30\uC77C \uB0B4): " + tk.good.map((d) => d.label + "(" + d.why + ")").join(" \xB7 ") + (tk.bad.length ? " / \uD53C\uD560 \uB0A0: " + tk.bad.map((d) => d.label).join(" \xB7 ") : "") : "") + "\n\uC9C1\uC5C5 \uAE30\uC6B4: \uC77C\uAC04 " + GAN_EL[idx.dG] + " \u2014 " + JOB_EL[GAN_EL[idx.dG]] + (maxEl !== GAN_EL[idx.dG] ? " (\uBD84\uD3EC \uCD5C\uB2E4 " + maxEl + " \uAE30\uC9C8 \uACB8\uD568)" : "");
}
const CF = {
  h: ["\uD655\uC2E4\uD55C \uAC83", "\uACC4\uC0B0\uC5D0\uC11C \uADF8\uB300\uB85C \uB098\uC628 \uAC12\uC774\uC57C \u2014 \uBCF4\uB294 \uC0AC\uB78C\uC5D0 \uB530\uB77C \uB2EC\uB77C\uC9C0\uC9C0 \uC54A\uC544"],
  m: ["\uAC08\uB9AC\uB294 \uAC83", "\uC624\uB798 \uC4F0\uC5EC \uC628 \uBC29\uC2DD\uB300\uB85C \uC77D\uC5C8\uC9C0\uB9CC, \uBCF4\uB294 \uB208\uC5D0 \uB530\uB77C \uB2F5\uC774 \uB2EC\uB77C\uC9C8 \uC218 \uC788\uC5B4"],
  l: ["\uACC1\uB4E4\uC774\uB294 \uAC83", "\uC608\uB85C\uBD80\uD130 \uC7AC\uBBF8 \uC0BC\uC544 \uACC1\uB4E4\uC774\uB358 \uC774\uC57C\uAE30\uC57C \u2014 \uBF08\uB300\uAC00 \uC544\uB2C8\uC57C"]
};
const Cf = ({ k }) => /* @__PURE__ */ jsx("i", { className: "cf cf" + k, title: CF[k][1], children: CF[k][0] });
const SPOUSE = {
  \uBE44\uACAC: "\uB300\uB4F1\uD55C \uC9DD. \uCE5C\uAD6C\uCC98\uB7FC \uC9C0\uB0B4\uB294 \uB300\uC2E0 \uC11C\uB85C \uC548 \uAD7D\uD600\uC11C \uBD80\uB52A\uD788\uAE30\uB3C4 \uD574",
  \uAC81\uC7AC: "\uC790\uAE30 \uC77C\uACFC \uBC8C\uC774\uAC00 \uC788\uB294 \uC9DD. \uAE30\uB300\uC624\uB294 \uC0AC\uB78C\uACFC\uB294 \uC624\uB798 \uBABB \uAC00\uACE0, \uB3C8 \uBB38\uC81C\uB294 \uCC98\uC74C\uBD80\uD130 \uAC08\uB77C\uB450\uB294 \uAC8C \uC88B\uC544",
  \uC2DD\uC2E0: "\uD3B8\uC548\uD55C \uC9DD. \uBA39\uACE0\uC0AC\uB294 \uAC71\uC815\uC774 \uB35C\uD55C \uB300\uC2E0 \uAE34\uC7A5\uC774 \uC5C6\uC5B4 \uB298\uC5B4\uC9C0\uAE30\uB3C4 \uD574",
  \uC0C1\uAD00: "\uC7AC\uC8FC \uC788\uACE0 \uB9D0 \uC798\uD558\uB294 \uC9DD. \uC790\uADF9\uC774 \uB418\uB294 \uB9CC\uD07C \uB9D0\uB85C \uC0C1\uCC98\uB3C4 \uC8FC\uACE0\uBC1B\uC544",
  \uC815\uC7AC: "\uC54C\uB730\uD558\uACE0 \uC131\uC2E4\uD55C \uC9DD. \uC548\uC815\uC801\uC778 \uB300\uC2E0 \uB2F5\uB2F5\uD558\uAC8C \uB290\uAEF4\uC9C0\uB294 \uC21C\uAC04\uC774 \uC640",
  \uD3B8\uC7AC: "\uD65C\uB2EC\uD558\uACE0 \uC500\uC500\uC774 \uD070 \uC9DD. \uD568\uAED8 \uBC8C\uC774\uB294 \uC7AC\uBBF8\uAC00 \uC788\uC9C0\uB9CC \uC500\uC500\uC774\uB294 \uB9DE\uCDB0\uC57C \uD574",
  \uC815\uAD00: "\uBC18\uB4EF\uD558\uACE0 \uCC45\uC784\uAC10 \uC788\uB294 \uC9DD. \uAE30\uB308 \uB9CC\uD55C \uB300\uC2E0 \uC6D0\uCE59\uC5D0\uC11C \uC11C\uB85C \uC548 \uBB3C\uB7EC\uC11C",
  \uD3B8\uAD00: "\uAC15\uB2E8 \uC788\uB294 \uC9DD. \uC704\uAE30\uC5D0 \uB4E0\uB4E0\uD55C\uB370 \uD3C9\uC18C\uC5D4 \uD33D\uD33D\uD574",
  \uC815\uC778: "\uD488\uC5B4\uC8FC\uB294 \uC9DD. \uBCF4\uC0B4\uD54C\uC744 \uBC1B\uB294 \uB300\uC2E0 \uC5B4\uB9AC\uAD11\uC774 \uB298 \uC218 \uC788\uC5B4",
  \uD3B8\uC778: "\uC0DD\uAC01\uC774 \uAE4A\uC740 \uC9DD. \uD1B5\uD558\uBA74 \uD06C\uAC8C \uD1B5\uD558\uB294\uB370 \uD63C\uC790 \uC788\uB294 \uC2DC\uAC04\uC744 \uB9CE\uC774 \uD544\uC694\uB85C \uD574"
};
const EL_KO = { \uBAA9: "\uB098\uBB34", \uD654: "\uBD88", \uD1A0: "\uD759", \uAE08: "\uC1E0", \uC218: "\uBB3C" };
const SS_KO = {
  \uBE44\uACAC: "\uB098\uB780\uD788 \uC11C\uB294 \uD798",
  \uAC81\uC7AC: "\uACA8\uB8E8\uB294 \uD798",
  \uC2DD\uC2E0: "\uBA39\uACE0\uC0AC\uB294 \uC7AC\uC8FC",
  \uC0C1\uAD00: "\uD280\uB294 \uC7AC\uC8FC",
  \uC815\uC7AC: "\uAFB8\uC900\uD55C \uC7AC\uBB3C",
  \uD3B8\uC7AC: "\uAD74\uB9AC\uB294 \uC7AC\uBB3C",
  \uC815\uAD00: "\uC790\uB9AC\uC640 \uCC45\uC784",
  \uD3B8\uAD00: "\uBAB0\uC544\uCE58\uB294 \uC555\uBC15",
  \uC815\uC778: "\uBC30\uC6C0\uACFC \uB3C4\uC6C0",
  \uD3B8\uC778: "\uD63C\uC790 \uD30C\uB294 \uD798"
};
const GRP_KO = { \uBE44\uAC81: "\uAC19\uC774 \uAC00\uB294 \uC790\uB9AC", \uC2DD\uC0C1: "\uB0B4\uB193\uB294 \uD798", \uC7AC\uC131: "\uC7AC\uBB3C \uC790\uB9AC", \uAD00\uC131: "\uC790\uB9AC\uC640 \uCC45\uC784", \uC778\uC131: "\uBC30\uC6C0\uC758 \uC790\uB9AC" };
const SIN_KO = { "\uC554\uB85D(\u6697\u797F)": "\uC228\uC740 \uBCF5", \uCC9C\uC744\uADC0\uC778: "\uB3D5\uB294 \uC190", \uBB38\uCC3D\uADC0\uC778: "\uAE00\uC758 \uBCF5", \uC5ED\uB9C8: "\uB5A0\uB3C4\uB294 \uAE30\uC6B4", \uB3C4\uD654: "\uB044\uB294 \uAE30\uC6B4", \uD654\uAC1C: "\uD640\uB85C \uAE4A\uC5B4\uC9C0\uB294 \uAE30\uC6B4" };
const STR_KO = { \uC2E0\uAC15: "\uC81C \uD798\uC73C\uB85C \uBBF8\uB294 \uCABD", \uC2E0\uC57D: "\uBC1B\uCCD0\uC918\uC57C \uC0AC\uB294 \uCABD", \uC911\uAC04: "\uC5B4\uB290 \uCABD\uB3C4 \uC544\uB2CC \uAC00\uC6B4\uB370" };
const EL_ORGAN = {
  // 오행 → 몸의 자리. 병명이 아니라 '어디가 약한가'까지만 말한다(창업자 지시 2026-08-10)
  \uBAA9: { organ: "\uAC04\xB7\uC4F8\uAC1C, \uB208, \uD798\uC904", lack: "\uB208\uC774 \uBE68\uB9AC \uD53C\uB85C\uD574\uC9C0\uACE0, \uD654\uB97C \uC0BC\uD0A4\uBA74 \uC606\uAD6C\uB9AC\uC640 \uC5B4\uAE68\uAC00 \uACB0\uB824", over: "\uC131\uC9C8\uC774 \uBA3C\uC800 \uC19F\uACE0 \uCC38\uC73C\uBA74 \uB450\uD1B5\uC774 \uC640. \uC220\uC774 \uC624\uB798 \uB0A8\uC544" },
  \uD654: { organ: "\uC2EC\uC7A5\xB7\uD608\uAD00, \uC18C\uC7A5", lack: "\uC190\uBC1C\uC774 \uCC28\uACE0 \uAC00\uC2B4\uC774 \uC790\uC8FC \uB450\uADFC\uAC70\uB824. \uACA8\uC6B8\uB9C8\uB2E4 \uAE30\uC6B4\uC774 \uD655 \uAEBC\uC838", over: "\uC5F4\uC774 \uC798 \uC624\uB974\uACE0 \uC7A0\uC774 \uC595\uC544. \uC785\uC548\uC774 \uC790\uC8FC \uD5D0\uACE0 \uB208\uC774 \uCDA9\uD608\uB3FC" },
  \uD1A0: { organ: "\uBE44\uC7A5\xB7\uC704, \uC18C\uD654, \uC0B4", lack: "\uC798 \uCCB4\uD558\uACE0, \uCC2C \uAC78 \uBA39\uC73C\uBA74 \uBC14\uB85C \uD0C8\uC774 \uB098", over: "\uBAB8\uC774 \uC798 \uBD93\uACE0 \uBB34\uAC70\uC6CC\uC838. \uC0DD\uAC01\uC774 \uB9CE\uC544 \uC7A0\uC744 \uB4A4\uCC99\uC5EC" },
  \uAE08: { organ: "\uD3D0\xB7\uB300\uC7A5, \uD53C\uBD80, \uCF54", lack: "\uCF54\uAC00 \uC790\uC8FC \uB9C9\uD788\uACE0 \uC0B4\uAC17\uC774 \uBA54\uB9D0\uB77C. \uD658\uC808\uAE30\uB9C8\uB2E4 \uAE30\uCE68\uC774 \uC624\uB798\uAC00", over: "\uC228\uC774 \uC595\uACE0 \uC794\uAE30\uCE68\uC774 \uAE38\uC5B4. \uD53C\uBD80\uAC00 \uC608\uBBFC\uD574 \uC798 \uB4A4\uC9D1\uD600" },
  \uC218: { organ: "\uCF69\uD325\xB7\uBC29\uAD11, \uBF08, \uADC0", lack: "\uD5C8\uB9AC\uAC00 \uC27D\uAC8C \uC2DC\uACE0 \uC800\uB141\uC774\uBA74 \uD798\uC774 \uB69D \uB5A8\uC5B4\uC838. \uBAB8\uC774 \uC798 \uB9D0\uB77C", over: "\uC544\uB7AB\uBC30\uAC00 \uCC28\uACE0 \uC798 \uBD80\uC5B4. \uAC81\uC774 \uB9CE\uC544\uC9C0\uACE0 \uBC24\uC5D0 \uC790\uC8FC \uAE68" }
};
const SS_EVENT = {
  \uC815\uC7AC: "\uC6D4\uAE09\uC774 \uC624\uB974\uAC70\uB098, \uACC4\uC57D\uC774 \uD558\uB098 \uAE38\uAC8C \uBD99\uAC70\uB098, \uC9D1\xB7\uCC28\uCC98\uB7FC \uB124 \uC774\uB984\uC774 \uC62C\uB77C\uAC00\uB294 \uBB3C\uAC74\uC774 \uC0DD\uACA8",
  \uD3B8\uC7AC: "\uBD80\uC5C5\xB7\uD22C\uC790\xB7\uC911\uAC1C\uCC98\uB7FC \uBAA9\uB3C8\uC774 \uC624\uAC00\uB294 \uD310\uC774 \uC5F4\uB824. \uD06C\uAC8C \uB4E4\uC5B4\uC624\uACE0 \uD06C\uAC8C \uB098\uAC00",
  \uC2DD\uC2E0: "\uC190\uC5D0 \uC775\uC740 \uAC78\uB85C \uBC8C\uC5B4\uBA39\uB294 \uC790\uB9AC\uAC00 \uC0DD\uACA8 \u2014 \uBA39\uB294 \uC77C\xB7\uAC00\uB974\uCE58\uB294 \uC77C\xB7\uB9CC\uB4DC\uB294 \uC77C",
  \uC0C1\uAD00: "\uB9D0\xB7\uAE00\xB7\uC601\uC0C1\xB7\uAE30\uD68D\uCC98\uB7FC \uD2F0 \uB098\uB294 \uAC78 \uB0B4\uB193\uAC8C \uB3FC. \uB300\uC2E0 \uC717\uC0AC\uB78C\uACFC \uD55C \uBC88\uC740 \uBD80\uB52A\uD600",
  \uC815\uAD00: "\uC9C1\uD568\uC774 \uC0DD\uAE30\uAC70\uB098 \uC2B9\uC9C4\uD558\uAC70\uB098, \uC790\uACA9\uC99D\xB7\uC2DC\uD5D8\uCC98\uB7FC \uC774\uB984\uC774 \uC11C\uB294 \uC77C\uC774 \uC640",
  \uD3B8\uAD00: "\uCC45\uC784\uC774 \uAC11\uC790\uAE30 \uC5B9\uD600 \u2014 \uC774\uC9C1\xB7\uBC1C\uB839\xB7\uC218\uC220\xB7\uC18C\uC1A1\uCC98\uB7FC \uBAB0\uC544\uCE58\uB294 \uC77C\uC774\uC57C",
  \uC815\uC778: "\uBC30\uC6C0\uC774 \uBD99\uC5B4. \uD559\uAD50\xB7\uC790\uACA9\xB7\uBB38\uC11C\xB7\uACC4\uC57D, \uADF8\uB9AC\uACE0 \uB3C4\uC640\uC8FC\uB294 \uC5B4\uB978\uC774 \uB098\uD0C0\uB098",
  \uD3B8\uC778: "\uD63C\uC790 \uD30C\uB294 \uC77C\uC774 \uC5F4\uB824 \u2014 \uC790\uACA9\xB7\uC5F0\uAD6C\xB7\uAE30\uC220\xB7\uC0C1\uB2F4 \uCABD\uC774\uC57C",
  \uBE44\uACAC: "\uB3D9\uC5C5\xB7\uD300\xB7\uAC19\uC740 \uCC98\uC9C0\uC758 \uC0AC\uB78C\uC774 \uBD99\uC5B4. \uB3C5\uB9BD\uC744 \uC0DD\uAC01\uD558\uAC8C \uB3FC",
  \uAC81\uC7AC: "\uACBD\uC7C1\uC790\uAC00 \uC0DD\uAE30\uACE0 \uB3C8\uC774 \uC0C8 \u2014 \uBCF4\uC99D\xB7\uB3D9\uC5C5\xB7\uBE4C\uB824\uC8FC\uAE30 \uC14B\uC774 \uD2B9\uD788 \uADF8\uB798"
};
const JOB_SHAPE = {
  \uAD00\uC131: { born: "\uC870\uC9C1 \uC548\uC5D0\uC11C \uC790\uB9AC\uB97C \uBC1B\uB294 \uCABD", grew: "\uADDC\uCE59\uC774 \uBD84\uBA85\uD55C \uB370\uC11C \uC624\uD788\uB824 \uD3B8\uD588\uACE0, \uB9E1\uAE30\uBA74 \uB05D\uAE4C\uC9C0 \uD588\uC744 \uAC70\uC57C", ex: "\uD68C\uC0AC\xB7\uACF5\uACF5\xB7\uC804\uBB38\uC9C1\uCC98\uB7FC \uC9C1\uD568\uC774 \uC788\uB294 \uC77C" },
  \uC2DD\uC0C1: { born: "\uB9CC\uB4E4\uC5B4\uC11C \uB0B4\uB193\uB294 \uCABD", grew: "\uC2DC\uD0A4\uB294 \uB300\uB85C \uD558\uB294 \uAC74 \uB2F5\uB2F5\uD588\uACE0, \uB124 \uBC29\uC2DD\uC73C\uB85C \uBC14\uAFD4\uC57C \uC190\uC774 \uC6C0\uC9C1\uC600\uC744 \uAC70\uC57C", ex: "\uAE30\uD68D\xB7\uCC3D\uC791\xB7\uAD50\uC721\xB7\uC694\uC2DD\uCC98\uB7FC \uACB0\uACFC\uBB3C\uC774 \uB124 \uC774\uB984\uC73C\uB85C \uB098\uAC00\uB294 \uC77C" },
  \uC7AC\uC131: { born: "\uAD74\uB824\uC11C \uB0A8\uAE30\uB294 \uCABD", grew: "\uAC12\uACFC \uC774\uC775\uC774 \uBA3C\uC800 \uBCF4\uC600\uACE0, \uC22B\uC790\uB85C \uB9D0\uD560 \uB54C \uC124\uB4DD\uB825\uC774 \uBD99\uC5C8\uC744 \uAC70\uC57C", ex: "\uC601\uC5C5\xB7\uC720\uD1B5\xB7\uC911\uAC1C\xB7\uC790\uC601\uC5C5\uCC98\uB7FC \uAC70\uB798\uAC00 \uACE7 \uC2E4\uB825\uC778 \uC77C" },
  \uBE44\uAC81: { born: "\uC81C \uD798\uC73C\uB85C \uBBF8\uB294 \uCABD", grew: "\uB204\uAD6C \uBC11\uBCF4\uB2E4 \uD63C\uC790\uAC00 \uBE68\uB790\uACE0, \uADF8\uB798\uC11C \uBD80\uB52A\uD788\uAE30\uB3C4 \uD588\uC744 \uAC70\uC57C", ex: "1\uC778 \uC0AC\uC5C5\xB7\uD504\uB9AC\uB79C\uC11C\xB7\uAE30\uC220\uC9C1\uCC98\uB7FC \uC2E4\uB825\uC774 \uACE7 \uAC04\uD310\uC778 \uC77C" }
};
const LV = (v) => v === 0 ? "\uBE44\uC5B4 \uC788\uC5B4" : v === 1 ? "\uC587\uC544" : v === 2 ? "\uBCF4\uD1B5\uC774\uC57C" : v === 3 ? "\uB450\uAEBC\uC6CC" : "\uB118\uCCD0";
const JONG = (w) => {
  const c = String(w).charCodeAt(String(w).length - 1) - 44032;
  return c >= 0 && c < 11172 ? c % 28 : 0;
};
const RO = (w) => w + (JONG(w) === 0 || JONG(w) === 8 ? "\uB85C" : "\uC73C\uB85C");
const IYA = (w) => w + (JONG(w) ? "\uC774\uC57C" : "\uC57C");
function lifeDomains(ctx) {
  const { idx, ssn, counts, strength, ys, sins, lackEl, ladder, nowAge, sex, hasHour } = ctx;
  const n = (k) => ssn[k] || 0;
  const G = { \uBE44\uAC81: n("\uBE44\uACAC") + n("\uAC81\uC7AC"), \uC2DD\uC0C1: n("\uC2DD\uC2E0") + n("\uC0C1\uAD00"), \uC7AC\uC131: n("\uC815\uC7AC") + n("\uD3B8\uC7AC"), \uAD00\uC131: n("\uC815\uAD00") + n("\uD3B8\uAD00"), \uC778\uC131: n("\uC815\uC778") + n("\uD3B8\uC778") };
  const KS = { \uBE44\uAC81: ["\uBE44\uACAC", "\uAC81\uC7AC"], \uC2DD\uC0C1: ["\uC2DD\uC2E0", "\uC0C1\uAD00"], \uC7AC\uC131: ["\uC815\uC7AC", "\uD3B8\uC7AC"], \uAD00\uC131: ["\uC815\uAD00", "\uD3B8\uAD00"], \uC778\uC131: ["\uC815\uC778", "\uD3B8\uC778"] };
  const me = GAN_EL[idx.dG];
  const ssOf = (d) => sipseong(idx.dG, GAN.indexOf(d.ganji[0]));
  const at = (d) => `${d.startAge}~${d.endAge}\uC138`;
  const cur = nowAge != null ? ladder.find((d) => nowAge >= d.startAge && nowAge <= d.endAge) || null : null;
  const nextOf = (ks) => ladder.find((d) => d.startAge > (nowAge || 0) && ks.includes(ssOf(d))) || null;
  const nextEl = (els) => ladder.find((d) => d.startAge > (nowAge || 0) && els.includes(d.el)) || null;
  const nowBy = (g, on, off) => !ladder.length ? "\uC131\uBCC4\uC774 \uC5C6\uC5B4\uC11C \uC9C0\uAE08\uC774 \uC5B4\uB290 \uC2ED \uB144\uC778\uC9C0 \uBABB \uC9DA\uC5B4 \u2014 \uD504\uB85C\uD544\uC5D0 \uC131\uBCC4\uC744 \uB354\uD558\uBA74 \uC774 \uCE78\uC774 \uCC44\uC6CC\uC838" : !cur ? `\uC544\uC9C1 \uCCAB \uC5F4 \uD574\uAC00 \uC2DC\uC791\uB418\uAE30 \uC804\uC774\uC57C. ${ladder[0].startAge}\uC138\uBD80\uD130 \uD070 \uD750\uB984\uC774 \uB3CC\uAE30 \uC2DC\uC791\uD574` : KS[g].includes(ssOf(cur)) ? `*${at(cur)} \u2014 \uC9C0\uAE08\uC774 \uBC14\uB85C \uADF8 \uC5F4 \uD574\uC57C.* ${on}` : `\uC9C0\uAE08 \uC5F4 \uD574(${at(cur)})\uB294 ${SS_KO[ssOf(cur)]} \uCABD\uC5D0 \uC3E0\uB824 \uC788\uC5B4. ${off}`;
  const nextBy = (g, none) => {
    if (!ladder.length) return "\uD750\uB984\uC758 \uBC29\uD5A5\uC774 \uC548 \uC11C\uC11C \uBABB \uD3BC\uCCE4\uC5B4";
    const d = nextOf(KS[g]);
    return d ? `*${at(d)}* \u2014 ${SS_KO[ssOf(d)]}\uAC00 \uC624\uB294 \uC5F4 \uD574\uC57C. ${SS_EVENT[ssOf(d)]}` : none;
  };
  const D = [];
  const put = (k, t, cf, a, b, c, d) => D.push({ k, t, cf, s: [["\uC0C8\uACA8\uC9C8 \uB54C", a], ["\uC790\uB77C\uBA74\uC11C", b], ["\uC9C0\uAE08", c], ["\uC55E\uC73C\uB85C", d]] });
  {
    const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
    const weak = lackEl.length ? lackEl : [sorted[0][0]];
    const [maxEl, maxN] = sorted[sorted.length - 1];
    const beaten = weak.filter((w) => GEUK[maxEl] === w);
    const born = weak.map((w) => `*${EL_KO[w]}\uC758 \uAE30\uC6B4\uC774 ${lackEl.includes(w) ? "\uBE44\uC5B4 \uC788\uC5B4" : "\uAC00\uC7A5 \uC587\uC544"}* \u2014 \uADF8 \uC790\uB9AC\uB294 ${IYA(EL_ORGAN[w].organ)}`).join(". ") + (maxN >= 3 ? `. \uBC18\uB300\uB85C *${EL_KO[maxEl]}\uAC00 ${maxN}\uAC1C*\uB85C \uBAB0\uB824 \uC788\uC5B4` : "") + (beaten.length ? `. \uADF8\uB9AC\uACE0 ${EL_KO[maxEl]}\uB294 ${EL_KO[beaten[0]]}\uB97C \uCE58\uB294 \uAE30\uC6B4\uC774\uB77C, *\uAC00\uC7A5 \uC587\uC740 \uC790\uB9AC\uB97C \uAC00\uC7A5 \uC13C \uD798\uC774 \uB54C\uB9AC\uB294 \uBC30\uCE58*\uC57C` : "");
    const grew = weak.map((w) => EL_ORGAN[w].lack).join(" \uADF8\uB9AC\uACE0 ") + (maxN >= 4 ? `. \uC5EC\uAE30\uC5D0 ${EL_ORGAN[maxEl].over}` : "");
    const helps = cur && (weak.includes(cur.el) || SAENG[cur.el] === weak[0]);
    const hurts = cur && GEUK[cur.el] === weak[0];
    const now = !ladder.length ? "\uC131\uBCC4\uC774 \uC5C6\uC5B4\uC11C \uC9C0\uAE08 \uC5F4 \uD574\uB97C \uBABB \uC9DA\uC5B4" : !cur ? "\uC544\uC9C1 \uCCAB \uC5F4 \uD574\uAC00 \uC2DC\uC791\uB418\uAE30 \uC804\uC774\uC57C" : helps ? `*${at(cur)} \u2014 \uC9C0\uAE08 \uC5F4 \uD574\uAC00 \uADF8 \uC790\uB9AC\uB97C \uCC44\uC6CC\uC918.* \uC774 \uAD6C\uAC04\uC774 \uBAB8\uC73C\uB85C\uB294 \uAC00\uC7A5 \uC218\uC6D4\uD574` : hurts ? `*${at(cur)} \u2014 \uC9C0\uAE08 \uC5F4 \uD574\uAC00 \uADF8 \uC587\uC740 \uC790\uB9AC\uB97C \uB354 \uB54C\uB824.* \uBB34\uB9AC\uD558\uBA74 \uAC70\uAE30\uBD80\uD130 \uC2E0\uD638\uAC00 \uC640` : `\uC9C0\uAE08 \uC5F4 \uD574(${at(cur)})\uB294 ${EL_KO[cur.el]}\uC758 \uAE30\uC6B4\uC774\uB77C \uC774 \uC790\uB9AC\uC640 \uC9C1\uC811 \uAD00\uACC4\uB294 \uC5C6\uC5B4`;
    const f = nextEl(weak.concat(ys.eokbu));
    put(
      "\uBAB8",
      "\uBAB8 \u2014 \uC5B4\uB514\uAC00 \uC57D\uD558\uAC8C \uC0C8\uACA8\uC84C\uB098",
      "m",
      born,
      `\uC5B4\uB9B4 \uB54C\uBD80\uD130 ${grew}.`,
      now,
      f ? `*${at(f)}\uBD80\uD130* ${EL_KO[f.el]}\uC758 \uAE30\uC6B4\uC774 \uB4E4\uC5B4\uC640 \u2014 ${weak.includes(f.el) ? "\uBE44\uC5B4 \uC788\uB358 \uBC14\uB85C \uADF8 \uC790\uB9AC\uC57C" : "\uB124\uAC8C \uD544\uC694\uD55C \uAE30\uC6B4\uC774\uC57C"}. \uADF8 \uC5F4 \uD574\uC5D0 \uBAB8\uC774 \uD55C \uB2E8\uACC4 \uD3B8\uD574\uC838` : `\uC5EC\uB4E0\uAE4C\uC9C0 ${weak.map((w) => EL_KO[w]).join("\xB7")}\uC758 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544. *\uD750\uB984\uC744 \uAE30\uB2E4\uB9B4 \uC790\uB9AC\uAC00 \uC544\uB2C8\uB77C \uD3C9\uC0DD \uAD00\uB9AC\uD560 \uC790\uB9AC*\uB77C\uB294 \uB73B\uC774\uC57C \u2014 \uACC1\uC5D0 \uB450\uBA74 \uC88B\uC740 \uAC74 ${EL_USE[weak[0]] ? EL_USE[weak[0]].color + "\xB7" + EL_USE[weak[0]].dir : ""}`
    );
  }
  {
    const ent = Object.entries(ssn).sort((a, b) => b[1] - a[1]);
    const topV = ent.length ? ent[0][1] : 0;
    const tops = ent.filter(([, v]) => v === topV);
    put(
      "\uB9C8\uC74C",
      "\uB9C8\uC74C \u2014 \uC5B4\uB5A4 \uC0AC\uB78C\uC73C\uB85C \uBC1C\uAE09\uB410\uB098",
      "m",
      `\uC5EC\uB35F \uC790\uB9AC \uC911 *\uB108 \uC790\uC2E0\uC744 \uAC00\uB9AC\uD0A4\uB294 \uD55C \uAE00\uC790\uB294 ${GAN[idx.dG]} \u2014 ${EL_KO[me]}*\uC57C. ${EL_READ[me]} \uADF8\uB9AC\uACE0 \uB108\uB97C \uBC1B\uCE58\uB294 \uAE00\uC790\uAC00 ${G.\uBE44\uAC81 + G.\uC778\uC131}\uAC1C\uB77C *${STR_KO[strength]}*\uC73C\uB85C \uB098\uC640`,
      topV <= 1 || tops.length >= 4 ? '\uAE30\uC6B4\uC774 *\uACE0\uB974\uAC8C \uD769\uC5B4\uC838 \uC788\uC5B4* \u2014 \uD55C\uCABD\uC73C\uB85C \uC3E0\uB9B0 \uC131\uACA9\uC774 \uC544\uB2C8\uC57C. "\uC774\uB7F0 \uC0AC\uB78C"\uC774\uB77C\uACE0 \uD55C \uB2E8\uC5B4\uB85C \uC548 \uBB36\uC774\uB294 \uB300\uC2E0, \uC5B4\uB290 \uD310\uC5D0 \uB193\uC5EC\uB3C4 \uADF8\uB7ED\uC800\uB7ED \uAD74\uB7EC\uAC00' : tops.length > 1 ? `\uAC00\uC7A5 \uB450\uAEBC\uC6B4 \uAC8C *${tops.map(([k]) => SS_KO[k]).join("\xB7")} ${topV}\uAC1C\uC529*\uC774\uC57C \u2014 \uB3D9\uB960\uC774\uB77C \uC5B4\uB290 \uCABD\uC774 \uC55E\uC774\uB77C\uACE0 \uBABB \uC798\uB77C. ${tops.map(([k]) => SS_TIP[k].r).join(" \uADF8\uB9AC\uACE0 ")}` : `\uAC00\uC7A5 \uB450\uAEBC\uC6B4 \uAC8C *${SS_KO[tops[0][0]]} ${topV}\uAC1C*\uC57C \u2014 ${SS_TIP[tops[0][0]].r}. \uADF8\uB298\uB3C4 \uAC19\uC774 \uC654\uC5B4: ${SS_TIP[tops[0][0]].s}`,
      !cur ? ladder.length ? "\uC544\uC9C1 \uCCAB \uC5F4 \uD574\uAC00 \uC2DC\uC791\uB418\uAE30 \uC804\uC774\uC57C" : "\uC131\uBCC4\uC774 \uC5C6\uC5B4\uC11C \uC9C0\uAE08 \uC5F4 \uD574\uB97C \uBABB \uC9DA\uC5B4" : `*${at(cur)}* \u2014 ${SS_KO[ssOf(cur)]}\uAC00 \uB3C4\uB294 \uC5F4 \uD574\uC57C. ${SS_TIP[ssOf(cur)].r}`,
      (() => {
        const d = ladder.find((x) => x.startAge > (nowAge || 0));
        return d ? `*${at(d)}\uBD80\uD130* ${RO(SS_KO[ssOf(d)])} \uACB0\uC774 \uBC14\uB00C\uC5B4. ${SS_EVENT[ssOf(d)]}` : "\uC5EC\uB4E0\uAE4C\uC9C0\uC758 \uD750\uB984\uC740 \uC544\uB798 \uADFC\uAC70 \uC808\uC5D0 \uC804\uBD80 \uD3BC\uCCD0 \uB480\uC5B4";
      })()
    );
  }
  {
    const mc = sins.some((x) => x.name === "\uBB38\uCC3D\uADC0\uC778");
    put(
      "\uBC30\uC6C0",
      "\uBC30\uC6C0 \u2014 \uACF5\uBD80\uAC00 \uBD99\uB294 \uBC29\uC2DD",
      "m",
      `\uBC30\uC6C0\uC744 \uB9E1\uC740 \uC790\uB9AC\uAC00 *${G.\uC778\uC131}\uAC1C, ${LV(G.\uC778\uC131)}*${mc ? ". \uADF8\uB9AC\uACE0 *\uAE00\uC758 \uBCF5*\uC774 \uC549\uC544 \uC788\uC5B4 \u2014 \uAE00\uACFC \uC2DC\uD5D8\uC73C\uB85C \uD478\uB294 \uC790\uB9AC\uC57C" : ""}`,
      G.\uC778\uC131 >= 3 ? "\uC124\uBA85\uD574 \uC8FC\uBA74 \uC798 \uBC1B\uC544\uB4E4\uC600\uACE0, \uC2DC\uC791 \uC804\uC5D0 \uC790\uB8CC\uBD80\uD130 \uBAA8\uC73C\uB294 \uC544\uC774\uC600\uC744 \uAC70\uC57C. \uB300\uC2E0 \uC900\uBE44\uAC00 \uAE38\uC5B4\uC838 \uC2DC\uC791\uC774 \uB2A6\uC5C8\uC5B4" : G.\uC778\uC131 === 0 ? `\uC549\uC544\uC11C \uC678\uC6B0\uB294 \uAC74 \uC624\uB798 \uBABB \uAC14\uC744 \uAC70\uC57C. *\uC190\uC73C\uB85C \uD574\uBCF4\uBA74 \uD55C \uBC88\uC5D0 \uBD99\uB294 \uCABD*\uC774\uC57C${G.\uC2DD\uC0C1 >= 2 ? " \u2014 \uB9CC\uB4E4\uBA74\uC11C \uBC30\uC6B0\uB294 \uAC8C \uB124 \uBC29\uC2DD\uC774\uC57C" : ""}` : "\uBC30\uC6B0\uB294 \uAC83\uB3C4 \uD558\uACE0 \uBAB8\uC73C\uB85C \uC775\uD788\uB294 \uAC83\uB3C4 \uD558\uB294, \uCE58\uC6B0\uCE58\uC9C0 \uC54A\uC740 \uCABD\uC774\uC57C",
      nowBy("\uC778\uC131", "\uBC30\uC6C0\uC774 \uBD99\uB294 \uC5F4 \uD574\uC57C \u2014 \uD559\uAD50\xB7\uC790\uACA9\xB7\uBB38\uC11C\uAC00 \uC720\uB3C5 \uC798 \uD480\uB824", "\uC774 \uC5F4 \uD574\uC5D4 \uBC30\uC6C0\uBCF4\uB2E4 \uADF8\uCABD\uC774 \uBA3C\uC800\uC57C. \uACF5\uBD80\uB294 \uC9E7\uAC8C \uB04A\uC5B4 \uAC00\uB294 \uAC8C \uB9DE\uC544"),
      nextBy("\uC778\uC131", "*\uC5EC\uB4E0\uAE4C\uC9C0 \uADF8 \uC790\uB9AC\uAC00 \uC5F4\uB9AC\uB294 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544.* \uBC30\uC6C0\uC740 \uD750\uB984\uC774 \uB370\uB824\uB2E4\uC8FC\uC9C0 \uC54A\uB294\uB2E4\uB294 \uB73B\uC774\uC57C \u2014 \uD544\uC694\uD558\uBA74 \uC9C0\uAE08 \uC0AC\uB46C\uC57C \uD574")
    );
  }
  {
    const order = ["\uAD00\uC131", "\uC2DD\uC0C1", "\uC7AC\uC131", "\uBE44\uAC81"];
    const best = Math.max(...order.map((k) => G[k]));
    const tied = best === 0 ? ["\uBE44\uAC81"] : order.filter((k) => G[k] === best);
    const key = tied[0], sh = JOB_SHAPE[key];
    put(
      "\uC77C",
      "\uC77C \u2014 \uC5B4\uB514\uC11C \uBC25\uC744 \uBC84\uB098",
      "m",
      `*${sh.born}*\uC73C\uB85C \uC0C8\uACA8\uC84C\uC5B4 (${["\uAD00\uC131", "\uC2DD\uC0C1", "\uC7AC\uC131", "\uBE44\uAC81"].map((k) => `${GRP_KO[k]} ${G[k]}`).join(" \xB7 ")})` + (tied.length > 1 ? `. \uB2E4\uB9CC *${tied.map((k) => GRP_KO[k]).join("\xB7")}\uAC00 ${best}\uAC1C\uB85C \uB3D9\uB960*\uC774\uB77C \uD55C\uCABD\uC73C\uB85C \uBABB \uC798\uB77C \u2014 ${tied.map((k) => JOB_SHAPE[k].born).join("\uACFC ")}\uC774 \uB458 \uB2E4 \uB124 \uACB0\uC774\uC57C` : "") + `. \uADF8\uB9AC\uACE0 \uB124 \uAE30\uC6B4\uC740 ${EL_KO[me]} \u2014 ${JOB_EL[me]}`,
      `${sh.grew}. \uB9DE\uB294 \uD310\uC740 *${sh.ex}*\uC774\uC57C`,
      nowBy(key, "\uB124 \uBC29\uC2DD\uC774 \uADF8\uB300\uB85C \uBA39\uD788\uB294 \uC5F4 \uD574\uC57C. \uD310\uC744 \uBC14\uAFB8\uB824\uBA74 \uC9C0\uAE08\uC774\uC57C", "\uB124 \uACB0\uC774 \uC544\uB2CC \uCABD\uC774 \uD798\uC744 \uC4F0\uB294 \uC5F4 \uD574\uB77C, \uC5B5\uC9C0\uB85C \uBC00\uAE30\uBCF4\uB2E4 \uBC30\uC6B0\uB294 \uB370 \uC4F0\uB294 \uAC8C \uB0A8\uC544"),
      nextBy(key, "\uC5EC\uB4E0\uAE4C\uC9C0 \uADF8 \uACB0\uC758 \uC5F4 \uD574\uB294 \uB2E4\uC2DC \uC624\uC9C0 \uC54A\uC544 \u2014 *\uC9C0\uAE08 \uC7A1\uC740 \uC790\uB9AC\uB97C \uC624\uB798 \uB04C\uACE0 \uAC00\uB294 \uAC8C \uB9DE\uC544*")
    );
  }
  {
    const jd = G.\uC7AC\uC131, weakRich = jd >= 3 && strength === "\uC2E0\uC57D";
    put(
      "\uB3C8",
      "\uB3C8 \u2014 \uC5BC\uB9C8\uB098 \uC950\uB294 \uADF8\uB987\uC778\uAC00",
      "m",
      weakRich ? `\uC7AC\uBB3C \uC790\uB9AC\uAC00 *${jd}\uAC1C\uB85C \uB450\uAEBC\uC6B4\uB370 \uB108\uB97C \uBC1B\uCE58\uB294 \uD798\uC740 ${G.\uBE44\uAC81 + G.\uC778\uC131}\uAC1C*\uC57C. \uC61B\uC0AC\uB78C\uB4E4\uC774 \uD2B9\uD788 \uC870\uC2EC\uD558\uB77C\uACE0 \uBCF8 \uBC30\uCE58 \u2014 **\uB3C8\uC740 \uBCF4\uC774\uB294\uB370 \uC958 \uD314 \uD798\uC774 \uBAA8\uC790\uB77C\uB294** \uADF8\uB987\uC774\uC57C` : jd === 0 ? "\uC7AC\uBB3C \uC790\uB9AC\uAC00 *\uBE44\uC5B4 \uC788\uC5B4*. \uC5C6\uB2E4\uB294 \uAC74 \uBABB \uBC88\uB2E4\uB294 \uAC8C \uC544\uB2C8\uB77C, *\uC815\uD574\uC9C4 \uB3C8(\uC6D4\uAE09\xB7\uACE0\uC815 \uACC4\uC57D)\uC774 \uB9DE\uACE0 \uAD74\uB9AC\uB294 \uB3C8\uC740 \uC0C8\uAE30 \uC27D\uB2E4*\uB294 \uB73B\uC774\uC57C" : jd >= 3 ? `\uC7AC\uBB3C \uC790\uB9AC\uAC00 *${jd}\uAC1C\uB85C \uB450\uAEBC\uC6CC*. \uD750\uB984\uC774 \uC5F4\uB9B4 \uB54C *\uD06C\uAC8C \uBC1B\uB294 \uADF8\uB987*\uC774\uC57C` : `\uC7AC\uBB3C \uC790\uB9AC\uAC00 *${jd}\uAC1C, ${LV(jd)}*. \uD06C\uAC8C \uD130\uC9C0\uC9C4 \uC54A\uC544\uB3C4 \uB04A\uAE30\uC9C0\uB3C4 \uC54A\uB294 \uCABD\uC774\uC57C`,
      weakRich ? "\uD070\uB3C8\uC774 \uB208\uC55E\uC744 \uC9C0\uB098\uAC00\uB294 \uAC78 \uC5EC\uB7EC \uBC88 \uBD24\uC744 \uAC70\uC57C. \uC7A1\uC73C\uB824\uB2E4 \uBAB8\uC774\uB098 \uC0AC\uB78C\uC744 \uC783\uC740 \uC801\uB3C4 \uC788\uACE0 \u2014 \uADF8\uB987\uC774 \uC544\uB2C8\uB77C *\uCCB4\uB825\uACFC \uC0AC\uB78C\uC758 \uBB38\uC81C*\uC600\uC5B4" : jd === 0 ? "\uD1B5\uC7A5\uC5D0 \uB0A8\uB294 \uAC8C \uC2E4\uB825\uBCF4\uB2E4 \uB298 \uC801\uC5C8\uC744 \uAC70\uC57C. \uD070 \uD310\uBCF4\uB2E4 *\uAF2C\uBC15\uAF2C\uBC15\uC774 \uB124 \uBC29\uC2DD*\uC774\uC57C" : "\uC4F8 \uB9CC\uD07C\uC740 \uB4E4\uC5B4\uC654\uACE0, \uD544\uC694\uD560 \uB54C \uC5B4\uB514\uC120\uAC00 \uC0DD\uAE30\uB294 \uD3B8\uC774\uC5C8\uC744 \uAC70\uC57C",
      nowBy("\uC7AC\uC131", "\uB3C8\uC774 \uC2E4\uC81C\uB85C \uC6C0\uC9C1\uC774\uB294 \uC5F4 \uD574\uC57C \u2014 \uACC4\uC57D\xB7\uAC70\uB798\xB7\uBAA9\uB3C8\uC774 \uC774 \uAD6C\uAC04\uC5D0 \uBAB0\uB824", "\uC774 \uC5F4 \uD574\uB294 \uB3C8\uBCF4\uB2E4 \uB2E4\uB978 \uAC8C \uBA3C\uC800\uC57C. \uBB34\uB9AC\uD574\uC11C \uAD74\uB9AC\uBA74 \uC0C8\uB294 \uCABD\uC774\uC57C"),
      nextBy("\uC7AC\uC131", "\uC5EC\uB4E0\uAE4C\uC9C0 \uC7AC\uBB3C\uC774 \uB3C4\uB294 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544 \u2014 *\uD55C \uBC29\uC744 \uAE30\uB2E4\uB9AC\uC9C0 \uB9D0\uACE0 \uACE0\uC815 \uC218\uC785\uC744 \uB450\uAECD\uAC8C \uD558\uB294 \uAC8C \uB124 \uC815\uB2F5*\uC774\uC57C")
    );
  }
  if (sex) {
    const g = sex === "M" ? "\uC7AC\uC131" : "\uAD00\uC131";
    const c = G[g], dh = sins.some((x) => x.name === "\uB3C4\uD654");
    put(
      "\uC5F0\uC560",
      "\uC5F0\uC560 \u2014 \uC778\uC5F0\uC774 \uC624\uB294 \uBC29\uC2DD",
      "m",
      `\uB124 \uC778\uC5F0\uC744 \uB9E1\uC740 \uC790\uB9AC\uAC00 *${c}\uAC1C, ${LV(c)}*${dh ? ". \uADF8\uB9AC\uACE0 *\uB044\uB294 \uAE30\uC6B4*\uC774 \uC549\uC544 \uC788\uC5B4 \u2014 \uC0AC\uB78C\uC774 \uBA3C\uC800 \uB2E4\uAC00\uC624\uB294 \uC790\uB9AC\uC57C" : ""}`,
      c === 0 ? "\uAC00\uB9CC\uD788 \uC788\uC73C\uBA74 \uC548 \uC654\uC744 \uAC70\uC57C. *\uB124\uAC00 \uC6C0\uC9C1\uC778 \uC790\uB9AC\uC5D0\uC11C\uB9CC* \uC0DD\uACBC\uC5B4" : c >= 3 ? "\uC5C6\uC5B4\uC11C \uBB38\uC81C\uC600\uB358 \uC801\uC740 \uC5C6\uACE0, *\uACE0\uB974\uB294 \uAC8C \uBB38\uC81C*\uC600\uC744 \uAC70\uC57C. \uC5EC\uB7FF\uC774 \uACB9\uCCD0 \uACE4\uB780\uD574\uC9C4 \uC801\uB3C4 \uC788\uACE0" : "\uB54C \uB418\uBA74 \uC624\uACE0 \uB54C \uB418\uBA74 \uC815\uB9AC\uB418\uB294, \uC694\uB780\uD558\uC9C0 \uC54A\uC740 \uCABD\uC774\uC5C8\uC5B4",
      nowBy(g, "\uC778\uC5F0\uC774 \uC2E4\uC81C\uB85C \uC6C0\uC9C1\uC774\uB294 \uC5F4 \uD574\uC57C \u2014 \uB9CC\uB098\uACE0 \uC815\uD558\uB294 \uC77C\uC774 \uC774 \uAD6C\uAC04\uC5D0 \uBAB0\uB824", "\uC774 \uC5F4 \uD574\uC5D4 \uC800\uC808\uB85C \uC624\uC9C0 \uC54A\uC544. \uC624\uBA74 \uB124\uAC00 \uB9CC\uB4E0 \uC790\uB9AC\uC5D0\uC11C \uC640"),
      nextBy(g, "\uC5EC\uB4E0\uAE4C\uC9C0 \uADF8 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544 \u2014 *\uB54C\uB97C \uAE30\uB2E4\uB9AC\uB294 \uC790\uB9AC\uAC00 \uC544\uB2C8\uC57C.* \uB124\uAC00 \uD310\uC744 \uB9CC\uB4DC\uB294 \uCABD\uC774 \uB9DE\uC544")
    );
  }
  {
    const sp = SPOUSE[sipseong(idx.dG, JI_BONGI[idx.dJ])];
    const chung = (idx.dJ + 6) % 12;
    const inNatal = [idx.yJ, idx.mJ, ...idx.hJ != null ? [idx.hJ] : []].includes(chung);
    const hitAt = ladder.filter((d) => JI.indexOf(d.ganji[1]) === chung);
    const future = hitAt.find((d) => d.startAge > (nowAge || 0));
    const nowHit = cur && JI.indexOf(cur.ganji[1]) === chung;
    put(
      "\uACB0\uD63C",
      "\uACB0\uD63C \u2014 \uC5B4\uB5A4 \uC9DD\uACFC \uC0AC\uB294\uAC00",
      "m",
      `\uC9DD\uC758 \uC790\uB9AC\uC5D0 \uC549\uC740 \uAC74 *${IYA(SS_KO[sipseong(idx.dG, JI_BONGI[idx.dJ])])}* \u2014 ${sp}` + (inNatal ? `. \uADF8\uB9AC\uACE0 \uADF8 \uC790\uB9AC\uB97C *\uC815\uBA74\uC73C\uB85C \uCE58\uB294 \uAE00\uC790\uAC00 \uD0DC\uC5B4\uB0A0 \uB54C\uBD80\uD130 \uD568\uAED8 \uBC15\uD600 \uC788\uC5B4* \u2014 \uC0AC\uB294 \uB3D9\uC548 \uADF8 \uC790\uB9AC\uAC00 \uD55C \uBC88\uC529 \uD754\uB4E4\uB9B0\uB2E4\uB294 \uB73B\uC774\uC57C` : ""),
      inNatal ? "\uAC00\uAE4C\uC6B4 \uC0AC\uC774\uC77C\uC218\uB85D \uBD80\uB52A\uD614\uC744 \uAC70\uC57C. \uB0A8\uD55C\uD14C\uB294 \uC798\uD558\uBA74\uC11C \uC9D1 \uC548\uC5D0\uC11C \uB0A0\uC774 \uC130\uB2E4\uB294 \uB9D0\uC744 \uB4E4\uC5C8\uC744 \uC218\uB3C4 \uC788\uC5B4" : "\uAD00\uACC4\uC5D0\uC11C \uD06C\uAC8C \uD754\uB4E4\uB9B0 \uC801\uC740 \uB4DC\uBB3C\uC5C8\uC744 \uAC70\uC57C. \uB300\uC2E0 \uCC38\uACE0 \uB118\uC5B4\uAC04 \uAC8C \uC313\uC5EC \uC788\uC5B4",
      !ladder.length ? "\uC131\uBCC4\uC774 \uC5C6\uC5B4\uC11C \uC9C0\uAE08 \uC5F4 \uD574\uB97C \uBABB \uC9DA\uC5B4" : nowHit ? `*${at(cur)} \u2014 \uC9C0\uAE08 \uC5F4 \uD574\uAC00 \uC9DD\uC758 \uC790\uB9AC\uB97C \uC815\uBA74\uC73C\uB85C \uCCD0.* \uC774 \uAD6C\uAC04\uC5D0 \uAD00\uACC4\uAC00 \uD55C \uBC88 \uD06C\uAC8C \uD754\uB4E4\uB824. \uB05D\uC774 \uC544\uB2C8\uB77C *\uC7AC\uACC4\uC57D*\uC774\uB77C\uACE0 \uBCF4\uBA74 \uB3FC` : cur ? `\uC9C0\uAE08 \uC5F4 \uD574(${at(cur)})\uB294 \uADF8 \uC790\uB9AC\uB97C \uAC74\uB4DC\uB9AC\uC9C0 \uC54A\uC544 \u2014 \uAD00\uACC4\uB85C\uB294 \uC870\uC6A9\uD55C \uAD6C\uAC04\uC774\uC57C` : "\uC544\uC9C1 \uCCAB \uC5F4 \uD574\uAC00 \uC2DC\uC791\uB418\uAE30 \uC804\uC774\uC57C",
      future ? `*${at(future)}*\uC5D0 \uADF8 \uC790\uB9AC\uAC00 \uD754\uB4E4\uB824. \uBBF8\uB9AC \uC54C\uACE0 \uB9DE\uB294 \uAC83\uACFC \uBAA8\uB974\uACE0 \uB9DE\uB294 \uAC74 \uACB0\uACFC\uAC00 \uB2EC\uB77C` : ladder.length ? "\uC5EC\uB4E0\uAE4C\uC9C0 \uC9DD\uC758 \uC790\uB9AC\uB97C \uC815\uBA74\uC73C\uB85C \uCE58\uB294 \uC5F4 \uD574\uB294 \uC5C6\uC5B4 \u2014 *\uAD00\uACC4\uB294 \uD750\uB984\uC774 \uC544\uB2C8\uB77C \uB124 \uD0DC\uB3C4\uAC00 \uC815\uD558\uB294 \uC790\uB9AC*\uC57C" : "\uD750\uB984\uC758 \uBC29\uD5A5\uC774 \uC548 \uC11C\uC11C \uBABB \uD3BC\uCCE4\uC5B4"
    );
  }
  if (sex) {
    const g = sex === "M" ? "\uAD00\uC131" : "\uC2DD\uC0C1";
    const c = G[g];
    put(
      "\uC790\uB140",
      "\uC790\uB140 \u2014 \uC544\uC774 \uC790\uB9AC",
      "m",
      `\uC544\uC774\uB97C \uB9E1\uC740 \uC790\uB9AC\uAC00 *${c}\uAC1C, ${LV(c)}*` + (hasHour ? "" : ". \uB2E4\uB9CC *\uD0DC\uC5B4\uB09C \uC2DC\uB97C \uBAB0\uB77C \uB124 \uC790\uB9AC \uC911 \uD558\uB098\uAC00 \uBE44\uC5C8\uC5B4* \u2014 \uC774 \uC790\uB9AC\uC758 \uC808\uBC18\uC740 \uBABB \uC77D\uC5C8\uB2E4\uACE0 \uBD10\uC57C \uD574"),
      c === 0 ? "\uC774 \uC790\uB9AC\uAC00 \uBE44\uC5C8\uB2E4\uACE0 \uC790\uC2DD\uC774 \uC5C6\uB2E4\uB294 \uB73B\uC774 \uC544\uB2C8\uC57C. *\uB2A6\uAC8C \uC624\uAC70\uB098, \uC560\uC4F4 \uB9CC\uD07C \uC640 \uC900\uB2E4*\uB294 \uCABD\uC774\uC57C" : c >= 3 ? "\uC544\uC774 \uC778\uC5F0\uC774 \uB450\uAECD\uAC8C \uC2E4\uB824 \uC788\uC5B4. \uB300\uC2E0 \uADF8\uB9CC\uD07C *\uB124 \uC2DC\uAC04\uACFC \uB3C8\uC774 \uADF8\uCABD\uC73C\uB85C \uAC04\uB2E4*\uB294 \uB73B\uC774\uAE30\uB3C4 \uD574" : "\uBB34\uB9AC \uC5C6\uC774 \uC624\uB294 \uC790\uB9AC\uC57C",
      nowBy(g, "\uC544\uC774 \uC77C\uC774 \uC2E4\uC81C\uB85C \uC6C0\uC9C1\uC774\uB294 \uC5F4 \uD574\uC57C", "\uC774 \uC5F4 \uD574\uB294 \uADF8\uCABD\uBCF4\uB2E4 \uB2E4\uB978 \uC790\uB9AC\uAC00 \uBA3C\uC800\uC57C"),
      nextBy(g, "\uC5EC\uB4E0\uAE4C\uC9C0 \uADF8 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544 \u2014 \uD750\uB984\uC744 \uAE30\uB2E4\uB9AC\uB294 \uC790\uB9AC\uAC00 \uC544\uB2C8\uB77C\uB294 \uB73B\uC774\uC57C")
    );
  }
  {
    const gw = sins.filter((x) => ["\uCC9C\uC744\uADC0\uC778", "\uC554\uB85D"].includes(x.name));
    put(
      "\uC0AC\uB78C",
      "\uC0AC\uB78C \u2014 \uACC1\uC5D0 \uB204\uAC00 \uC11C\uB294\uAC00",
      "m",
      `\uAC19\uC774 \uAC00\uB294 \uC790\uB9AC\uAC00 *${G.\uBE44\uAC81}\uAC1C, ${LV(G.\uBE44\uAC81)}*` + (gw.length ? `. \uADF8\uB9AC\uACE0 *${gw.map((x) => SIN_KO[x.name] || x.name).join("\xB7")}*\uC774 \uC788\uC5B4 \u2014 \uB9C9\uD790 \uB54C \uC0AC\uB78C\uC774 \uB098\uD0C0\uB098 \uB6AB\uB9AC\uB294 \uC790\uB9AC\uC57C` : ""),
      G.\uBE44\uAC81 === 0 ? "\uBB34\uB9AC\uC5D0 \uC11E\uC774\uAE30\uBCF4\uB2E4 \uD63C\uC790 \uD558\uB294 \uAC8C \uBE68\uB790\uC744 \uAC70\uC57C. \uB3C4\uC640\uC904 \uC0AC\uB78C\uC744 \uBABB \uCC3E\uC740 \uAC8C \uC544\uB2C8\uB77C *\uC548 \uBD80\uB978 \uCABD*\uC774\uC57C" : G.\uBE44\uAC81 >= 3 ? "\uC0AC\uB78C\uC740 \uB298 \uC788\uC5C8\uC744 \uAC70\uC57C. \uB300\uC2E0 *\uB098\uB20C \uB54C \uB124 \uBAAB\uC774 \uC904\uACE0, \uBE4C\uB824\uC900 \uB3C8\uC774 \uC548 \uB3CC\uC544\uC628* \uC801\uC774 \uC788\uC5B4" : "\uD544\uC694\uD560 \uB54C \uC606\uC5D0 \uC11C \uC8FC\uB294 \uC0AC\uB78C\uC774 \uD55C\uB458\uC740 \uC788\uC5C8\uC5B4",
      nowBy("\uBE44\uAC81", "\uC0AC\uB78C\uC774 \uBAB0\uB9AC\uB294 \uC5F4 \uD574\uC57C \u2014 \uB3D9\uC5C5\xB7\uD300\xB7\uB3C5\uB9BD \uC774\uC57C\uAE30\uAC00 \uC774 \uAD6C\uAC04\uC5D0 \uB098\uC640", "\uC774 \uC5F4 \uD574\uB294 \uC0AC\uB78C\uBCF4\uB2E4 \uB124 \uC77C\uC774 \uBA3C\uC800\uC57C"),
      nextBy("\uBE44\uAC81", "\uC5EC\uB4E0\uAE4C\uC9C0 \uADF8 \uC5F4 \uD574\uB294 \uC624\uC9C0 \uC54A\uC544 \u2014 *\uD63C\uC790 \uAC00\uB294 \uAC8C \uAE30\uBCF8\uAC12*\uC778 \uC0B6\uC774\uC57C. \uB098\uC05C \uAC8C \uC544\uB2C8\uB77C \uACC4\uC0B0\uC5D0 \uB123\uC73C\uB77C\uB294 \uB9D0\uC774\uC57C")
    );
  }
  return D;
}
const Em = ({ t }) => /* @__PURE__ */ jsx(Fragment, { children: String(t).split("*").map((s, i) => i % 2 ? /* @__PURE__ */ jsx("b", { children: s }, i) : /* @__PURE__ */ jsx("span", { children: s }, i)) });
const IMPRINT_PRICE = 9900;
const josa = (w, a, b) => {
  const c = String(w).charCodeAt(String(w).length - 1) - 44032;
  return c >= 0 && c < 11172 && c % 28 ? a : b;
};
function wrap2(t, max = 9) {
  const s = String(t);
  if (s.length <= max) return [s];
  const words = s.split(" ");
  let a = "", b = "";
  for (const w of words) {
    if (!b && (a ? a.length + 1 + w.length : w.length) <= max) a = a ? a + " " + w : w;
    else b = b ? b + " " + w : w;
  }
  return b ? [a, b] : [a];
}
function ImprintDoc({ saju, birth, sex, onClose }) {
  const [notesOn, setNotesOn] = useState(false);
  const [extra, setExtra] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("binari_imprint_extra") || "{}");
    } catch {
      return {};
    }
  });
  const [askOpen, setAskOpen] = useState(extra.married == null && (/* @__PURE__ */ new Date()).getFullYear() - +(birth?.y || 0) + 1 >= 20);
  const setEx = (k, v) => {
    const n = { ...extra, [k]: v };
    setExtra(n);
    try {
      localStorage.setItem("binari_imprint_extra", JSON.stringify(n));
    } catch {
    }
  };
  const r = useMemo(() => {
    try {
      const ladder = [];
      if (sex && birth && birth.y) {
        for (let a = 1; a <= 71; a += 10) {
          const du = daeun(
            +birth.y,
            +birth.m,
            +birth.d,
            birth.noHour ? 12 : +birth.h,
            birth.noHour || birth.min === "" ? 0 : +birth.min,
            !!birth.noHour,
            cityLon(birth.city),
            sex === "M",
            +birth.y + a - 1
          );
          if (du && !du.pre && !ladder.some((x) => x.startAge === du.startAge)) ladder.push(du);
        }
      }
      return readImprint({
        saju,
        ladder,
        birth,
        sex,
        lon: cityLon(birth?.city),
        lat: cityLat(birth?.city),
        married: extra.married ?? null,
        kids: extra.kids ?? null,
        timeAcc: extra.timeAcc ?? null,
        metAge: extra.metAge ?? null
      });
    } catch (e) {
      return null;
    }
  }, [saju, birth, sex, extra.married, extra.kids, extra.timeAcc, extra.metAge]);
  useEffect(() => {
    track("imprint_opened", { has_sex: !!sex, has_hour: !!(saju?.idx && saju.idx.hG != null), has_extra: extra.married != null });
  }, []);
  if (!r) return /* @__PURE__ */ jsxs("div", { className: "imp", children: [
    /* @__PURE__ */ jsx("p", { className: "impmsg", children: "\uAC01\uC778\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4. \uC0DD\uB144\uC6D4\uC77C\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC904\uB798?" }),
    /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: onClose, children: "\uB2EB\uC744\uAC8C" })
  ] });
  const Ref = ({ n }) => notesOn && n ? /* @__PURE__ */ jsx("sup", { className: "impfx", children: n }) : null;
  const H = ({ t }) => /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: t } });
  const Row = ([k, v, n], i) => /* @__PURE__ */ jsxs("div", { className: "impr", children: [
    /* @__PURE__ */ jsx("div", { className: "impk", children: k }),
    /* @__PURE__ */ jsxs("div", { className: "impv", children: [
      /* @__PURE__ */ jsx(H, { t: v }),
      /* @__PURE__ */ jsx(Ref, { n })
    ] })
  ] }, i);
  const W = 320;
  const LifeChart = () => {
    if (!r.bands.length) return null;
    const F = { \uC815\uC7AC: 2, \uD3B8\uC7AC: 3, \uC2DD\uC2E0: 1, \uC0C1\uAD00: 2, \uC815\uAD00: -1, \uD3B8\uAD00: -2, \uC815\uC778: 1, \uD3B8\uC778: 0, \uBE44\uACAC: 1, \uAC81\uC7AC: -1 };
    const bw = (W - 20) / r.bands.length;
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} 108`, width: "100%", height: "108", className: "impsvg", role: "img", "aria-label": "\uC5EC\uB4E0 \uD574\uC758 \uB192\uB0AE\uC774", children: [
      r.bands.map((b, i) => {
        const f = F[b.ss] ?? 0, h = 8 + Math.abs(f) * 13, y = f >= 0 ? 58 - h : 58;
        const on = r.cur && b.from === r.cur.from;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: 10 + i * bw + 2,
              y,
              width: bw - 4,
              height: h,
              rx: "2",
              fill: f >= 2 ? "#5b8fd4" : f === 1 ? "#4a6f9e" : f === 0 ? "#6f6580" : f === -1 ? "#a8674f" : "#a83229",
              opacity: on ? 1 : 0.75
            }
          ),
          /* @__PURE__ */ jsx("text", { x: 10 + i * bw + bw / 2, y: 96, fontSize: "7.5", fill: on ? "#f5d98b" : "#8a7f95", textAnchor: "middle", children: b.from })
        ] }, i);
      }),
      /* @__PURE__ */ jsx("line", { x1: "10", y1: "58", x2: W - 10, y2: "58", stroke: "#c9b98f44" }),
      /* @__PURE__ */ jsx("text", { x: W - 10, y: "104", fontSize: "7", fill: "#6f6580", textAnchor: "end", children: "\uC704\uB85C \uAC08\uC218\uB85D \uC21C\uD55C \uC5F4 \uD574" })
    ] });
  };
  const MonthChart = () => {
    const ms = [...r.when.hardMonths.map((m) => [m, -1]), ...r.when.softMonths.map((m) => [m, 1])].sort((a, b) => a[0] - b[0]);
    if (!ms.length) return null;
    const bw = (W - 20) / 12;
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} 82`, width: "100%", height: "82", className: "impsvg", role: "img", "aria-label": "\uC5F4\uB450 \uB2EC\uC758 \uB192\uB0AE\uC774", children: [
      [...Array(12)].map((_, i) => {
        const m = i + 1, f = (ms.find((x) => x[0] === m) || [0, 0])[1], h = 6 + Math.abs(f) * 26;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("rect", { x: 10 + i * bw + 2, y: f >= 0 ? 50 - h : 50, width: bw - 4, height: h, rx: "2", fill: f > 0 ? "#5b8fd4" : f < 0 ? "#a83229" : "#6f6580", opacity: "0.85" }),
          /* @__PURE__ */ jsx("text", { x: 10 + i * bw + bw / 2, y: 70, fontSize: "7.5", fill: "#8a7f95", textAnchor: "middle", children: m })
        ] }, m);
      }),
      /* @__PURE__ */ jsx("line", { x1: "10", y1: "50", x2: W - 10, y2: "50", stroke: "#c9b98f44" })
    ] });
  };
  const _unusedBar = () => {
    const t = r.witness.tally, tot = r.witness.total;
    const C = ["#5b8fd4", "#c98f3d", "#8a7f95", "#6f6580", "#4a4256"];
    let x = 10;
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} 54`, width: "100%", height: "54", className: "impsvg", role: "img", "aria-label": "\uC544\uD649 \uD558\uB298\uC758 \uC9D1\uACC4", children: [
      t.map((v, i) => {
        const w = (W - 20) * v.n / tot, cur = x;
        x += w;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("rect", { x: cur, y: "10", width: Math.max(w - 2, 1), height: "18", rx: "2", fill: C[i] || "#4a4256" }),
          w > 30 && /* @__PURE__ */ jsx("text", { x: cur + w / 2, y: "23", fontSize: "9", fill: "#0f0b18", textAnchor: "middle", children: v.n })
        ] }, i);
      }),
      /* @__PURE__ */ jsxs("text", { x: "10", y: "44", fontSize: "8", fill: "#c9b98f", children: [
        t[0].w,
        " ",
        t[0].n
      ] }),
      t[1] && /* @__PURE__ */ jsxs("text", { x: W - 10, y: "44", fontSize: "8", fill: "#8a7f95", textAnchor: "end", children: [
        t[1].w,
        " ",
        t[1].n
      ] })
    ] });
  };
  const MoneyJourney = () => {
    const p = r.money.path;
    if (!p.length) return null;
    const H2 = 150, PAD = 26, gw = (W - PAD * 2) / (p.length - 1 || 1);
    const yOf = (v) => 118 - (v + 4) / 8 * 92;
    const pts = p.map((x, i) => [PAD + i * gw, yOf(x.v)]);
    const line = pts.map((q, i) => i ? `L${q[0]},${q[1]}` : `M${q[0]},${q[1]}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0]},118 L${pts[0][0]},118 Z`;
    const pk = r.money.peak ? p.indexOf(r.money.peak) : -1;
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} ${H2}`, width: "100%", height: H2, className: "impsvg drawin", role: "img", "aria-label": "\uB3C8\uC758 \uC5EC\uC815", children: [
      /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "mg", x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#c98f3d", stopOpacity: "0.42" }),
        /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#c98f3d", stopOpacity: "0" })
      ] }) }),
      /* @__PURE__ */ jsx("line", { x1: PAD - 8, y1: yOf(0), x2: W - PAD + 8, y2: yOf(0), stroke: "#6f658055", strokeDasharray: "2 3" }),
      /* @__PURE__ */ jsx("path", { d: area, fill: "url(#mg)", className: "mfill" }),
      /* @__PURE__ */ jsx("path", { d: line, fill: "none", stroke: "#e0b063", strokeWidth: "2", strokeLinejoin: "round", className: "mline" }),
      pts.map((q, i) => /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            cx: q[0],
            cy: q[1],
            r: p[i].now ? 5 : i === pk ? 4.5 : 2.6,
            fill: p[i].now ? "#f5d98b" : i === pk ? "#e0b063" : "#8a7f95"
          }
        ),
        /* @__PURE__ */ jsx("text", { x: q[0], y: 136, fontSize: "7.5", fill: p[i].now ? "#f5d98b" : "#8a7f95", textAnchor: "middle", children: p[i].from })
      ] }, i)),
      pk >= 0 && /* @__PURE__ */ jsx("text", { x: Math.min(Math.max(pts[pk][0], 44), W - 44), y: pts[pk][1] - 9, fontSize: "8.5", fill: "#f0e2b8", textAnchor: "middle", children: "\uAC00\uC7A5 \uB450\uAEBC\uC6B4 \uB54C" }),
      p.some((x) => x.now) && /* @__PURE__ */ jsx("text", { x: Math.min(Math.max(pts[p.findIndex((x) => x.now)][0], 26), W - 26), y: pts[p.findIndex((x) => x.now)][1] + 15, fontSize: "8", fill: "#f5d98b", textAnchor: "middle", children: "\uC9C0\uAE08" }),
      /* @__PURE__ */ jsx("text", { x: PAD - 8, y: 12, fontSize: "7", fill: "#6f6580", children: "\u2191 \uB450\uAEBC\uC6C0" }),
      /* @__PURE__ */ jsx("text", { x: W - PAD + 8, y: 148, fontSize: "7", fill: "#6f6580", textAnchor: "end", children: "\uC138(\u6B72)" })
    ] });
  };
  const Compass = () => {
    const c = r.compass;
    if (!c.self && !c.mate) return null;
    const DIRS = [["\uBD81", 0], ["\uBD81\uB3D9", 45], ["\uB3D9", 90], ["\uB0A8\uB3D9", 135], ["\uB0A8", 180], ["\uB0A8\uC11C", 225], ["\uC11C", 270], ["\uBD81\uC11C", 315]];
    const cx = 160, cy = 82, R0 = 56;
    const at = (deg, rr) => [cx + rr * Math.sin(deg * Math.PI / 180), cy - rr * Math.cos(deg * Math.PI / 180)];
    return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 320 168", width: "100%", height: "168", className: "impsvg drawin", role: "img", "aria-label": "\uBC29\uC704", children: [
      /* @__PURE__ */ jsx("circle", { cx, cy, r: R0, fill: "none", stroke: "#6f658055" }),
      /* @__PURE__ */ jsx("circle", { cx, cy, r: R0 - 16, fill: "none", stroke: "#6f658033" }),
      DIRS.map(([nm, d]) => {
        const [x, y] = at(d, R0 + 12);
        const isSelf = c.self && c.self.dir === nm, isMate = c.mate && c.mate.dir === nm;
        return /* @__PURE__ */ jsxs("g", { children: [
          (isSelf || isMate) && /* @__PURE__ */ jsx(
            "line",
            {
              x1: cx,
              y1: cy,
              x2: at(d, R0)[0],
              y2: at(d, R0)[1],
              stroke: isSelf ? "#e0b063" : "#5b8fd4",
              strokeWidth: "2.4"
            }
          ),
          /* @__PURE__ */ jsx(
            "text",
            {
              x,
              y: y + 3,
              fontSize: isSelf || isMate ? "10" : "8.5",
              textAnchor: "middle",
              fill: isSelf ? "#f0e2b8" : isMate ? "#9dc0ee" : "#6f6580",
              children: nm
            }
          )
        ] }, nm);
      }),
      /* @__PURE__ */ jsx("circle", { cx, cy, r: "3.4", fill: "#c9b98f" }),
      c.self && /* @__PURE__ */ jsxs("text", { x: "14", y: "150", fontSize: "9", fill: "#e0b063", children: [
        "\u25CF \uB9C9\uD790 \uB54C \uC6C0\uC9C1\uC77C \uCABD \u2014 ",
        c.self.dir
      ] }),
      c.mate && /* @__PURE__ */ jsxs("text", { x: "306", y: "150", fontSize: "9", fill: "#5b8fd4", textAnchor: "end", children: [
        "\u25CF \uC9DD\uC774 \uC624\uB294 \uCABD \u2014 ",
        c.mate.dir
      ] })
    ] });
  };
  const JourneyMap = () => {
    const c = r.saga?.chapters;
    if (!c || !c.length) return null;
    const H2 = 176, x0 = 24, gw = (W - x0 * 2) / (c.length - 1 || 1);
    const at = (i) => [x0 + i * gw, 92 + 24 * Math.sin(i * 0.92)];
    const pts = c.map((_, i) => at(i));
    const seg = (a2, b2) => `M${a2[0]},${a2[1]} Q${(a2[0] + b2[0]) / 2},${(a2[1] + b2[1]) / 2 - 12} ${b2[0]},${b2[1]}`;
    const nowI = c.findIndex((x) => x.now);
    const GLYPH = { \uAD00\uBB38: "\u25C6", \uBCF4\uBB3C: "\u2726", \uC2DC\uB828: "\u25B2", \uC870\uB825\uC790: "\u25C7", "\uC228\uC740 \uB9C8\uB514": "\u25C9" };
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} ${H2}`, width: "100%", height: H2, className: "impsvg drawin", role: "img", "aria-label": "\uC5EC\uC815 \uC9C0\uB3C4", children: [
      pts.slice(0, -1).map((q, i) => {
        const done = nowI < 0 ? false : i < nowI;
        return /* @__PURE__ */ jsx(
          "path",
          {
            d: seg(q, pts[i + 1]),
            fill: "none",
            stroke: done ? "#6f6580" : "#c98f3d",
            strokeWidth: done ? 1.4 : 1.8,
            strokeDasharray: done ? "" : "4 4",
            opacity: done ? 0.75 : 0.9,
            className: "jline"
          },
          i
        );
      }),
      c.map((ch, i) => {
        const [x, y] = pts[i], on = ch.now, up = i % 2 === 0;
        const g = ch.marks.length ? GLYPH[ch.marks[0].k] : null;
        return /* @__PURE__ */ jsxs("g", { children: [
          on && /* @__PURE__ */ jsx("circle", { cx: x, cy: y, r: "10", fill: "#f5d98b", opacity: "0.18", className: "pulse" }),
          /* @__PURE__ */ jsx(
            "circle",
            {
              cx: x,
              cy: y,
              r: on ? 5.5 : ch.past ? 3 : 3.6,
              fill: on ? "#f5d98b" : ch.past ? "#6f6580" : "#c98f3d"
            }
          ),
          g && /* @__PURE__ */ jsx("text", { x, y: y + (up ? -13 : 19), fontSize: "9", fill: "#e8a06a", textAnchor: "middle", children: g }),
          /* @__PURE__ */ jsxs("text", { x, y: y + (up ? -25 : 31), fontSize: "8", fill: on ? "#f5d98b" : "#8a7f95", textAnchor: "middle", children: [
            ch.from,
            "\uC138"
          ] }),
          /* @__PURE__ */ jsxs("text", { x, y: y + (up ? -34 : 40), fontSize: "7.5", fill: "#6f6580", textAnchor: "middle", children: [
            ch.i,
            "\uC7A5"
          ] })
        ] }, i);
      }),
      nowI >= 0 && /* @__PURE__ */ jsx(
        "text",
        {
          x: Math.min(Math.max(pts[nowI][0], 30), W - 30),
          y: pts[nowI][1] + (nowI % 2 === 0 ? 17 : -11),
          fontSize: "8.5",
          fill: "#f5d98b",
          textAnchor: "middle",
          children: "\uC5EC\uAE30"
        }
      ),
      /* @__PURE__ */ jsx("text", { x: x0, y: 166, fontSize: "7", fill: "#6f6580", children: "\u25C6 \uAD00\uBB38 \u2726 \uBCF4\uBB3C \u25B2 \uC2DC\uB828 \u25C7 \uC870\uB825\uC790 \u25C9 \uC228\uC740 \uB9C8\uB514" }),
      /* @__PURE__ */ jsx("text", { x: W - x0, y: 166, fontSize: "7", fill: "#6f6580", textAnchor: "end", children: "\uC810\uC120 = \uC544\uC9C1 \uC548 \uC628 \uAE38" })
    ] });
  };
  const YearBar = () => {
    const ys = r.work?.years;
    if (!ys?.length) return null;
    const bw = (W - 20) / ys.length;
    return /* @__PURE__ */ jsxs("svg", { viewBox: `0 0 ${W} 78`, width: "100%", height: "78", className: "impsvg drawin", role: "img", "aria-label": "\uC5EC\uC12F \uD574\uC758 \uC21C\uC5ED", children: [
      ys.map((y, i) => {
        const h = 6 + Math.abs(y.f) * 16;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: 10 + i * bw + 3,
              y: y.f >= 0 ? 44 - h : 44,
              width: bw - 6,
              height: h,
              rx: "2",
              fill: y.f > 0 ? "#5b8fd4" : y.f < 0 ? "#a83229" : "#6f6580",
              opacity: i === 0 ? 1 : 0.82
            }
          ),
          /* @__PURE__ */ jsx("text", { x: 10 + i * bw + bw / 2, y: 66, fontSize: "8", fill: i === 0 ? "#f5d98b" : "#8a7f95", textAnchor: "middle", children: y.year })
        ] }, i);
      }),
      /* @__PURE__ */ jsx("line", { x1: "10", y1: "44", x2: W - 10, y2: "44", stroke: "#c9b98f44" }),
      /* @__PURE__ */ jsx("text", { x: W - 10, y: 13, fontSize: "7", fill: "#6f6580", textAnchor: "end", children: "\uC704 = \uC6C0\uC9C1\uC774\uAE30 \uC88B\uC740 \uD574" })
    ] });
  };
  const CoreFig = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 320 116", width: "100%", height: "116", className: "impsvg", role: "img", "aria-label": "\uAC89\uACFC \uC18D", children: [
    /* @__PURE__ */ jsx("rect", { x: "8", y: "20", width: "118", height: "66", rx: "4", fill: "none", stroke: "#8a7f95", strokeWidth: "1.4" }),
    /* @__PURE__ */ jsx("text", { x: "67", y: "14", fontSize: "8", fill: "#8a7f95", textAnchor: "middle", letterSpacing: "2", children: "\uAC89" }),
    wrap2(r.core.surface.w).map((ln, i) => /* @__PURE__ */ jsx("text", { x: "67", y: 46 + i * 15, fontSize: "11", fill: "#e6dff2", textAnchor: "middle", children: ln }, i)),
    /* @__PURE__ */ jsx("rect", { x: "194", y: "20", width: "118", height: "66", rx: "4", fill: "none", stroke: "#a83229", strokeWidth: "1.4" }),
    /* @__PURE__ */ jsx("text", { x: "253", y: "14", fontSize: "8", fill: "#e8a06a", textAnchor: "middle", letterSpacing: "2", children: "\uC18D" }),
    wrap2(r.core.inner.w).map((ln, i) => /* @__PURE__ */ jsx("text", { x: "253", y: 46 + i * 15, fontSize: "11", fill: "#f0b6ab", textAnchor: "middle", children: ln }, i)),
    /* @__PURE__ */ jsx("path", { d: "M188 53 L146 53", stroke: "#e8a06a", strokeWidth: "1.6" }),
    /* @__PURE__ */ jsx("path", { d: "M152 48 L144 53 L152 58", fill: "none", stroke: "#e8a06a", strokeWidth: "1.6" }),
    /* @__PURE__ */ jsx("line", { x1: "160", y1: "34", x2: "160", y2: "72", stroke: "#a83229", strokeWidth: "3" }),
    /* @__PURE__ */ jsx("line", { x1: "152", y1: "40", x2: "168", y2: "66", stroke: "#a83229", strokeWidth: "1.6" }),
    /* @__PURE__ */ jsxs("text", { x: "160", y: "86", fontSize: "8", fill: "#f0b6ab", textAnchor: "middle", children: [
      r.core.block.t,
      "\uC774 \uC587\uB2E4"
    ] }),
    /* @__PURE__ */ jsx("text", { x: "160", y: "106", fontSize: "7.5", fill: "#6f6580", textAnchor: "middle", children: "\uADF8\uB798\uC11C \uC548\uC5D0\uC11C\uB9CC \uB3C8\uB2E4" })
  ] });
  return /* @__PURE__ */ jsxs("div", { className: "imp fade", children: [
    /* @__PURE__ */ jsxs("div", { className: "imphead", children: [
      /* @__PURE__ */ jsx("p", { className: "impeyebrow", children: "\uBE44 \uB098 \uB9AC \xB7 \uAC01 \uC778" }),
      /* @__PURE__ */ jsx("p", { className: "imptitle", children: "\uB124\uAC00 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uC5B4\uC84C\uB294\uC9C0" }),
      /* @__PURE__ */ jsxs("p", { className: "impsub", children: [
        "\uC774\uAC74 \uD55C \uC9C8\uBB38\uC5D0 \uB300\uD55C \uB2F5\uC774 \uC544\uB2C8\uC57C. ",
        /* @__PURE__ */ jsx("b", { children: "\uB108\uB77C\uB294 \uC0AC\uB78C \uC804\uCCB4" }),
        "\uC5D0 \uB300\uD55C \uBB38\uC11C\uC57C. \uC790\uB9AC\uB9C8\uB2E4 \uB137\uC73C\uB85C \uB098\uB220 \uC801\uC5C8\uC5B4 \u2014 ",
        /* @__PURE__ */ jsx("b", { children: "\uC5B4\uB5BB\uAC8C \uD0DC\uC5B4\uB0AC\uB098, \uC790\uB77C\uBA70 \uC5B4\uB5BB\uAC8C \uB098\uD0C0\uB0AC\uB098, \uC9C0\uAE08 \uC5B4\uB514\uC778\uAC00, \uC55E\uC73C\uB85C \uC5B4\uB5BB\uAC8C \uB418\uB098." })
      ] })
    ] }),
    askOpen && /* @__PURE__ */ jsxs("div", { className: "impask fade", children: [
      /* @__PURE__ */ jsxs("p", { className: "impaskh", children: [
        "\uB450\uC5B4 \uAC00\uC9C0\uB9CC \uC54C\uB824\uC8FC\uBA74 \uD6E8\uC52C \uC815\uD655\uD574\uC838 ",
        /* @__PURE__ */ jsx("i", { children: "\uC804\uBD80 \uC120\uD0DD\uC774\uC57C" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "impaskrow", children: [
        /* @__PURE__ */ jsx("span", { children: "\uACB0\uD63C\uD588\uC5B4?" }),
        /* @__PURE__ */ jsx("button", { className: "impchip" + (extra.married === true ? " on" : ""), onClick: () => setEx("married", true), children: "\uD588\uC5B4" }),
        /* @__PURE__ */ jsx("button", { className: "impchip" + (extra.married === false ? " on" : ""), onClick: () => setEx("married", false), children: "\uC544\uC9C1" })
      ] }),
      extra.married === true && /* @__PURE__ */ jsxs("div", { className: "impaskrow", children: [
        /* @__PURE__ */ jsx("span", { children: "\uC5B8\uC81C \uB9CC\uB0AC\uC5B4?" }),
        [["20\uB300 \uCD08", 23], ["20\uB300 \uD6C4", 27], ["30\uB300 \uCD08", 32], ["30\uB300 \uD6C4", 37], ["\uADF8 \uB4A4", 42]].map(([l, v]) => /* @__PURE__ */ jsx("button", { className: "impchip" + (extra.metAge === v ? " on" : ""), onClick: () => setEx("metAge", v), children: l }, v))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "impaskrow", children: [
        /* @__PURE__ */ jsx("span", { children: "\uC544\uC774\uAC00 \uC788\uC5B4?" }),
        /* @__PURE__ */ jsx("button", { className: "impchip" + (extra.kids === true ? " on" : ""), onClick: () => setEx("kids", true), children: "\uC788\uC5B4" }),
        /* @__PURE__ */ jsx("button", { className: "impchip" + (extra.kids === false ? " on" : ""), onClick: () => setEx("kids", false), children: "\uC5C6\uC5B4" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "impaskw", children: [
        "\uC774\uAC78 \uBAA8\uB974\uBA74 ",
        /* @__PURE__ */ jsx("b", { children: "\uC774\uBBF8 \uC9C0\uB09C \uC77C\uC744 \uC55E\uC77C\uCC98\uB7FC" }),
        " \uC801\uAC8C \uB3FC. \uC548 \uC54C\uB824\uC918\uB3C4 \uBB38\uC11C\uB294 \uB098\uC624\uC9C0\uB9CC, \uADF8 \uBD80\uBD84\uC774 \uD5D0\uAC70\uC6CC\uC838."
      ] }),
      /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => setAskOpen(false), children: extra.married != null || extra.kids != null ? "\uC774\uB300\uB85C \uC77D\uC744\uAC8C" : "\uC548 \uC54C\uB824\uC904\uB798" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "imph", children: "\uB108\uB294 \uC5B4\uB5A4 \uC0AC\uB78C\uC778\uAC00" }),
    /* @__PURE__ */ jsxs("p", { className: "impdcl", children: [
      "\uB108\uB294 ",
      /* @__PURE__ */ jsx("b", { children: r.core.surface.w }),
      josa(r.core.surface.w, "\uC774\uC57C", "\uC57C"),
      ".",
      /* @__PURE__ */ jsx(Ref, { n: r.core.n1 })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      r.core.surface.d,
      "."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "impcore", children: [
      /* @__PURE__ */ jsx("p", { className: "impk2", children: "\uADF8 \uB7F0 \uB370" }),
      /* @__PURE__ */ jsxs("p", { className: "impcv", children: [
        "\uB124 \uC18D\uC740 \uB2E4\uB974\uB2E4. ",
        /* @__PURE__ */ jsxs("b", { children: [
          r.core.inner.w,
          "."
        ] }),
        /* @__PURE__ */ jsx(Ref, { n: r.core.n2 })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "impcw", children: [
        r.core.inner.d,
        ". ",
        r.core.split ? "\uAC89\uC73C\uB85C \uBCF4\uC774\uB294 \uBAA8\uC2B5\uACFC \uC18D\uC774 \uB2E4\uB978 \uC0AC\uB78C\uC774\uC57C." : "\uAC89\uACFC \uC18D\uC774 \uAC19\uC740 \uBC29\uD5A5\uC774\uB77C \uC624\uD574\uB294 \uB35C \uBC1B\uC544."
      ] })
    ] }),
    /* @__PURE__ */ jsx(CoreFig, {}),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      /* @__PURE__ */ jsxs("b", { children: [
        "\uADF8\uB9AC\uACE0 \uB124\uAC8C\uB294 ",
        r.core.block.t,
        "\uC774 \uC587\uC544."
      ] }),
      /* @__PURE__ */ jsx(Ref, { n: r.core.n3 }),
      " ",
      r.core.block.s,
      ". ",
      r.core.block.w
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "impfix", children: [
      /* @__PURE__ */ jsx("b", { children: "\uADF8\uB798\uC11C \uD544\uC694\uD55C \uAC74 \uD558\uB098\uC57C" }),
      " \u2014 ",
      r.core.block.fix,
      "."
    ] }),
    r.saga && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("p", { className: "imph", children: [
        "\uB108\uC758 \uC774\uC57C\uAE30 ",
        /* @__PURE__ */ jsx("i", { children: "\uB0B4\uAC00 \uC9C0\uCF1C\uBCF8 \uB300\uB85C" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "impsaga", children: [
        /* @__PURE__ */ jsx(H, { t: r.saga.prologue }),
        /* @__PURE__ */ jsx(Ref, { n: r.saga.n })
      ] }),
      /* @__PURE__ */ jsx(JourneyMap, {}),
      r.saga.chapters.map((ch, i) => /* @__PURE__ */ jsxs("div", { className: "impch" + (ch.now ? " on" : "") + (ch.past ? " past" : ""), children: [
        /* @__PURE__ */ jsxs("p", { className: "impchh", children: [
          /* @__PURE__ */ jsxs("i", { children: [
            "\uC81C",
            ch.i,
            "\uC7A5"
          ] }),
          ch.title,
          /* @__PURE__ */ jsxs("em", { children: [
            ch.from,
            "~",
            ch.to,
            "\uC138"
          ] }),
          ch.now ? /* @__PURE__ */ jsx("b", { className: "here", children: "\uC5EC\uAE30" }) : null
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "impchw", children: [
          ch.what,
          ch.when ? /* @__PURE__ */ jsxs("span", { className: "impchd", children: [
            " \xB7 ",
            ch.when
          ] }) : null
        ] }),
        ch.marks.map((m, k) => /* @__PURE__ */ jsxs("p", { className: "impmark", children: [
          /* @__PURE__ */ jsx("i", { children: m.k }),
          /* @__PURE__ */ jsx(H, { t: m.w })
        ] }, k))
      ] }, i)),
      /* @__PURE__ */ jsx("p", { className: "impepi", children: /* @__PURE__ */ jsx(H, { t: r.saga.epilogue }) })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "imph", children: [
      "\uC544\uD649 \uD558\uB298 ",
      /* @__PURE__ */ jsx("i", { children: "\uAC01\uC790 \uB2E4\uB978 \uAC78 \uBCF8\uB2E4" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      "\uC544\uD649 \uBB38\uBA85\uC774 ",
      /* @__PURE__ */ jsx("b", { children: "\uC11C\uB85C \uB2E4\uB978 \uC9C8\uBB38" }),
      "\uC744 \uB9E1\uC558\uC5B4. \uAC19\uC740 \uAC78 \uC544\uD649 \uBC88 \uBB3B\uC9C0 \uC54A\uC544 \u2014 \uC0AC\uC8FC\uAC00 ",
      /* @__PURE__ */ jsx("b", { children: "\uBABB \uD558\uB294 \uC9C8\uBB38" }),
      "\uC744 \uD558\uB098\uC529 \uB098\uB220 \uAC00\uC84C\uC5B4. \uC0B6\uC744 \uC5F4\uB450 \uC790\uB9AC\uB85C \uCABC\uAC1C\uB294 \uCD95, \uBC29\uC704, \uB0A0\uC758 \uBB34\uAC8C, \uC2DC\uC791\uC5D0 \uAC15\uD55C\uAC00 \uB9C8\uBB34\uB9AC\uC5D0 \uAC15\uD55C\uAC00. ",
      /* @__PURE__ */ jsx("b", { children: "\uC0AC\uC8FC\uC5D0\uB294 \uC774 \uC9C8\uBB38 \uC790\uCCB4\uAC00 \uC5C6\uC5B4." })
    ] }),
    r.sky9.map((x, i) => /* @__PURE__ */ jsxs("div", { className: "impsky", children: [
      /* @__PURE__ */ jsxs("p", { className: "impskh", children: [
        /* @__PURE__ */ jsx("i", { children: x.from }),
        x.ask,
        /* @__PURE__ */ jsx(Ref, { n: x.n })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "impskv", children: x.val }),
      /* @__PURE__ */ jsx("p", { className: "impskw", children: /* @__PURE__ */ jsx(H, { t: x.say }) })
    ] }, i)),
    /* @__PURE__ */ jsxs("p", { className: "imph", children: [
      "\uC0AC\uC8FC\uC640 \uB2E4\uB974\uAC8C \uC77D\uD788\uB294 \uACF3 ",
      /* @__PURE__ */ jsx("i", { children: "\uC5EC\uAE30\uAC00 \uAC08\uB9AC\uB294 \uC9C0\uC810\uC774\uC57C" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      "\uC0AC\uC8FC \uD55C \uBC8C\uB9CC \uBD24\uC73C\uBA74 ",
      /* @__PURE__ */ jsx("b", { children: "\uBABB \uB098\uC654\uC744 \uAC83\uB4E4" }),
      "\uC774\uC57C. \uACB9\uCE58\uB294 \uAC74 \uB354 \uBB34\uAC81\uAC8C \uBCF4\uACE0, \uC5B4\uAE0B\uB098\uB294 \uAC74 \uC5B4\uAE0B\uB09C \uCC44\uB85C \uB46C \u2014 ",
      /* @__PURE__ */ jsx("b", { children: "\uC0AC\uB78C\uC740 \uD55C \uC904\uB85C \uC548 \uC801\uD600." })
    ] }),
    r.clash.map((c, i) => /* @__PURE__ */ jsxs("div", { className: "impclash", children: [
      /* @__PURE__ */ jsx("b", { children: c.t }),
      /* @__PURE__ */ jsx(Ref, { n: c.n }),
      /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx(H, { t: c.w }) })
    ] }, i)),
    /* @__PURE__ */ jsxs("p", { className: "imph", children: [
      "\uC0DD\uAE40\uC0C8 ",
      /* @__PURE__ */ jsx("i", { children: "\uAC70\uC6B8 \uC55E\uC5D0\uC11C \uBC14\uB85C \uD655\uC778\uB3FC" })
    ] }),
    r.body.map(Row),
    /* @__PURE__ */ jsx("p", { className: "imph", children: "\uC5B8\uC81C \uB124\uAC00 \uB108 \uAC19\uC9C0 \uC54A\uC740\uAC00" }),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      "\uC0AC\uB78C\uC740 \uB298 \uAC19\uC9C0 \uC54A\uC544. ",
      /* @__PURE__ */ jsx("b", { children: "\uCC28\uBD84\uD55C \uC0AC\uB78C\uB3C4 \uBB34\uB108\uC9C8 \uB54C\uAC00 \uC788\uACE0, \uC21C\uD55C \uC0AC\uB78C\uB3C4 \uC0AC\uB098\uC6CC\uC9C8 \uB54C\uAC00 \uC788\uC5B4." }),
      " \uB124 \uACC1\uC5D0 \uC788\uC744 \uC0AC\uB78C\uB4E4\uC774 \uC54C\uC544\uC57C \uD560 \uAC74 \uB124\uAC00 \uC5B4\uB5A4 \uC0AC\uB78C\uC778\uC9C0\uAC00 \uC544\uB2C8\uB77C ",
      /* @__PURE__ */ jsx("b", { children: "\uC5B8\uC81C \uB124\uAC00 \uB2EC\uB77C\uC9C0\uB294\uC9C0" }),
      "\uC57C."
    ] }),
    r.trig.map((t, i) => /* @__PURE__ */ jsxs("div", { className: "imptrig", children: [
      /* @__PURE__ */ jsx("b", { children: t.t }),
      /* @__PURE__ */ jsx(Ref, { n: t.n }),
      /* @__PURE__ */ jsx("p", { children: t.w })
    ] }, i)),
    /* @__PURE__ */ jsx(MonthChart, {}),
    /* @__PURE__ */ jsxs("p", { className: "impwhen", children: [
      /* @__PURE__ */ jsx("b", { children: "\uD574\uB9C8\uB2E4" }),
      " ",
      r.when.hardMonths.length ? `${r.when.hardMonths.join("\xB7")}\uC6D4\uC774 \uBB34\uAC81\uB2E4` : "\uD2B9\uBCC4\uD788 \uBB34\uAC70\uC6B4 \uB2EC\uC740 \uC5C6\uB2E4",
      r.when.softMonths.length ? ` \xB7 ${r.when.softMonths.join("\xB7")}\uC6D4\uC774 \uC21C\uD558\uB2E4` : "",
      ".",
      /* @__PURE__ */ jsx(Ref, { n: r.when.n }),
      " \uBB34\uAC70\uC6B4 \uB2EC\uC5D4 \uC0C8\uB85C \uC2DC\uC791\uD558\uC9C0 \uB9D0\uACE0 \uD558\uB358 \uAC78 \uC9C0\uCF1C."
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "imph", children: [
      "\uB124 \uC0B6\uC758 ",
      ["", "\uD55C", "\uB450", "\uC138", "\uB124", "\uB2E4\uC12F", "\uC5EC\uC12F", "\uC77C\uACF1", "\uC5EC\uB35F", "\uC544\uD649"][r.domains.length] || r.domains.length,
      " \uC790\uB9AC ",
      /* @__PURE__ */ jsx("i", { children: "\uD0DC\uC5B4\uB0A0 \uB54C \xB7 \uC790\uB77C\uBA74\uC11C \xB7 \uC9C0\uAE08 \xB7 \uC55E\uC73C\uB85C" })
    ] }),
    r.domains.map((d, i) => /* @__PURE__ */ jsxs("div", { className: "impdom", children: [
      /* @__PURE__ */ jsxs("p", { className: "impdh", children: [
        d.t,
        /* @__PURE__ */ jsx(Ref, { n: d.n })
      ] }),
      d.steps.map(([lab, txt], k) => /* @__PURE__ */ jsxs("div", { className: "impstep", children: [
        /* @__PURE__ */ jsx("i", { children: lab }),
        /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(H, { t: txt }) })
      ] }, k)),
      d.west && /* @__PURE__ */ jsxs("p", { className: "impwest", children: [
        /* @__PURE__ */ jsx(H, { t: d.west.w }),
        /* @__PURE__ */ jsx(Ref, { n: d.west.n })
      ] }),
      d.k === "\uB3C8" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(MoneyJourney, {}),
        /* @__PURE__ */ jsxs("p", { className: "impcap", children: [
          "\uB124 \uC5EC\uB4E0 \uD574 \uC548\uC5D0\uC11C\uC758 \uB192\uB0AE\uC774\uC57C. ",
          /* @__PURE__ */ jsx("b", { children: "\uAE08\uC561\uC774 \uC544\uB2C8\uB77C \uC21C\uC11C" }),
          "\uC57C \u2014",
          r.money.peak ? /* @__PURE__ */ jsxs(Fragment, { children: [
            " \uAC00\uC7A5 \uB450\uAEBC\uC6B4 \uB54C\uB294 ",
            /* @__PURE__ */ jsxs("b", { children: [
              r.money.peak.from,
              "~",
              r.money.peak.to,
              "\uC138"
            ] }),
            ", ",
            r.money.peak.how,
            "."
          ] }) : null,
          r.money.trough ? /* @__PURE__ */ jsxs(Fragment, { children: [
            " \uAC00\uC7A5 \uC587\uC740 \uB54C\uB294 ",
            /* @__PURE__ */ jsxs("b", { children: [
              r.money.trough.from,
              "~",
              r.money.trough.to,
              "\uC138"
            ] }),
            "\uC57C."
          ] }) : null,
          /* @__PURE__ */ jsx(Ref, { n: r.money.n })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "impmrows", children: r.money.path.filter((x) => !x.young).map((x, i2) => /* @__PURE__ */ jsxs("div", { className: "impmrow" + (x.now ? " on" : ""), children: [
          /* @__PURE__ */ jsxs("b", { children: [
            x.from,
            "~",
            x.to
          ] }),
          /* @__PURE__ */ jsx("span", { children: x.how })
        ] }, i2)) })
      ] })
    ] }, i)),
    r.work && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("p", { className: "imph", children: [
        "\uC9C1\uC7A5\uC0DD\uD65C ",
        /* @__PURE__ */ jsx("i", { children: "\uC5B4\uB5A4 \uC77C\uC774 \uB9DE\uB098\uAC00 \uC544\uB2C8\uB77C, \uC870\uC9C1\uC5D0\uC11C \uC5B4\uB5BB\uAC8C \uAD74\uB7EC\uAC00\uB098" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "impp", children: [
        "\uB9DE\uB294 \uC9C1\uC5C5\uC744 \uACE8\uB77C\uB3C4 ",
        /* @__PURE__ */ jsx("b", { children: "\uC870\uC9C1\uC5D0\uC11C \uBABB \uBC84\uD2F0\uB294 \uC0AC\uB78C" }),
        "\uC774 \uC788\uC5B4. \uCD95\uC774 \uB2E4\uB974\uAC70\uB4E0. \uC5EC\uAE34 ",
        /* @__PURE__ */ jsx("b", { children: "\uB124\uAC00 \uC5B4\uB5BB\uAC8C \uC77C\uD558\uACE0, \uB204\uAD6C\uB791 \uB9DE\uACE0, \uC5B4\uB514\uAE4C\uC9C0 \uAC00\uACE0, \uC5B8\uC81C \uC6C0\uC9C1\uC774\uB098" }),
        "\uB97C \uBD10."
      ] }),
      r.work.rows.map(Row),
      /* @__PURE__ */ jsxs("p", { className: "imph2", children: [
        "\uC5B8\uC81C \uC6C0\uC9C1\uC774\uB098 ",
        /* @__PURE__ */ jsx("i", { children: "\uC5EC\uC12F \uD574" })
      ] }),
      /* @__PURE__ */ jsx(YearBar, {}),
      /* @__PURE__ */ jsx("div", { className: "impyrs", children: r.work.years.map((y, i) => /* @__PURE__ */ jsxs("div", { className: "impyr" + (y.f > 0 ? " up" : y.f < 0 ? " dn" : ""), children: [
        /* @__PURE__ */ jsx("b", { children: y.year }),
        /* @__PURE__ */ jsx("span", { children: y.w })
      ] }, i)) }),
      /* @__PURE__ */ jsxs("p", { className: "impcap", children: [
        r.work.goYear ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("b", { children: [
            r.work.goYear.year,
            "\uB144"
          ] }),
          "\uC774 \uC62E\uAE30\uAE30 \uAC00\uC7A5 \uC88B\uC740 \uD574\uC57C. "
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          "\uC5EC\uC12F \uD574 \uC548\uC5D0 ",
          /* @__PURE__ */ jsx("b", { children: "\uC790\uB9AC\uAC00 \uC5F4\uB9AC\uB294 \uD574\uAC00 \uC5C6\uC5B4." }),
          " \uC9C0\uAE08 \uC790\uB9AC\uC5D0\uC11C \uAC12\uC744 \uC62C\uB9AC\uB294 \uAC8C \uB0A8\uC544. "
        ] }),
        r.work.badYear ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("b", { children: [
            r.work.badYear.year,
            "\uB144"
          ] }),
          "\uC740 \uD53C\uD574 \u2014 \uC6C0\uC9C1\uC774\uBA74 \uC190\uD574\uAC70\uB098 \uBC00\uB824\uC11C \uC6C0\uC9C1\uC774\uAC8C \uB3FC. "
        ] }) : null,
        r.work.nextBand ? /* @__PURE__ */ jsxs(Fragment, { children: [
          "\uC2ED \uB144 \uD310 \uC790\uCCB4\uB294 ",
          /* @__PURE__ */ jsxs("b", { children: [
            r.work.nextBand.from,
            "\uC138"
          ] }),
          "\uC5D0 \uBC14\uB00C\uC5B4(",
          r.work.nextBand.title,
          ")."
        ] }) : null,
        r.work.moveBand ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " \uADF8\uB9AC\uACE0 ",
          /* @__PURE__ */ jsxs("b", { children: [
            r.work.moveBand.from,
            "~",
            r.work.moveBand.to,
            "\uC138"
          ] }),
          "\uC5D0 ",
          r.work.moveBand.why,
          " \uD55C \uBC88 \uBC00\uB824\uC11C \uC6C0\uC9C1\uC774\uAC8C \uB3FC."
        ] }) : null,
        /* @__PURE__ */ jsx(Ref, { n: r.work.n })
      ] })
    ] }),
    r.compass && (r.compass.self || r.compass.mate) && /* @__PURE__ */ jsx(Compass, {}),
    r.mate && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("p", { className: "imph", children: [
        r.mateMode === "wed" ? "\uC9DD \u2014 \uC774\uBBF8 \uACC1\uC5D0 \uC788\uB294 \uC0AC\uB78C" : "\uC9DD \u2014 \uB204\uAD6C\uB97C \uB9CC\uB098\uB098",
        r.mateMode === "wed" ? /* @__PURE__ */ jsx("i", { children: "\uC0DD\uAE40\uC0C8\uB294 \uB124\uAC00 \uB354 \uC798 \uC54C\uC544" }) : null
      ] }),
      r.mate.map(Row)
    ] }),
    !r.mate && /* @__PURE__ */ jsxs("p", { className: "impmsg", children: [
      "\uC9DD \uC790\uB9AC\uB294 ",
      /* @__PURE__ */ jsx("b", { children: "\uC131\uBCC4\uC774 \uC788\uC5B4\uC57C" }),
      " \uC5B4\uB290 \uAE00\uC790\uAC00 \uADF8 \uC778\uC5F0\uC778\uC9C0 \uAC08\uB824 \u2014 \uD504\uB85C\uD544\uC5D0 \uB354\uD558\uBA74 \uC5F4\uB824."
    ] }),
    /* @__PURE__ */ jsx("p", { className: "imph", children: "\uC5EC\uB4E0 \uD574 \u2014 \uB124 \uC778\uC0DD \uC9C0\uB3C4" }),
    r.bands.length === 0 && /* @__PURE__ */ jsxs("p", { className: "impmsg", children: [
      "\uC5F4 \uD574 \uB2E8\uC704 \uD070 \uD750\uB984\uC740 ",
      /* @__PURE__ */ jsx("b", { children: "\uC131\uBCC4\uC774 \uC788\uC5B4\uC57C" }),
      " \uBC29\uD5A5\uC774 \uC11C."
    ] }),
    /* @__PURE__ */ jsx(LifeChart, {}),
    r.bands.map((b, i) => /* @__PURE__ */ jsxs("div", { className: "impband" + (r.cur && b.from === r.cur.from ? " now" : ""), children: [
      /* @__PURE__ */ jsxs("div", { className: "impage", children: [
        b.from,
        "~",
        b.to,
        /* @__PURE__ */ jsx("i", { children: "\uC138" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("b", { children: b.title }),
        r.cur && b.from === r.cur.from ? /* @__PURE__ */ jsx("em", { children: " \u25C2 \uC9C0\uAE08" }) : null,
        b.doubleTurn ? /* @__PURE__ */ jsx("em", { className: "dbl", children: " \u25C6 \uB450 \uC148\uC774 \uAC19\uC774 \uBC14\uB00C\uB294 \uD574" }) : null,
        /* @__PURE__ */ jsxs("p", { children: [
          b.event,
          b.dashaKo ? ` \xB7 ${b.dashaKo}` : ""
        ] }),
        b.dashaOnly ? /* @__PURE__ */ jsx("p", { className: "only", children: "\uC0AC\uC8FC\uB85C\uB294 \uC870\uC6A9\uD55C\uB370 \uC778\uB3C4 \uC148\uB9CC \uBC14\uB00C\uB294 \uAD6C\uAC04\uC774 \uC5EC\uAE30 \uB4E4\uC5B4 \uC788\uC5B4" }) : null
      ] })
    ] }, i)),
    /* @__PURE__ */ jsxs("p", { className: "imph", children: [
      "\uC9C0\uAE08 \uD655\uC778\uD574 \uBCF4\uC544\uB77C ",
      /* @__PURE__ */ jsx("i", { children: "\uC624\uB298 \uC54C \uC218 \uC788\uB294 \uAC83\uB4E4" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "impp", children: [
      "\uC65C \uADF8\uB7F0\uC9C0\uB294 \uC548 \uC801\uC5C8\uC5B4. ",
      /* @__PURE__ */ jsx("b", { children: "\uB300\uC2E0 \uD655\uC778\uD560 \uBC29\uBC95\uC744 \uC904\uAC8C." }),
      " \uC544\uB798\uAC00 \uB9DE\uB294\uC9C0\uB294 \uB124\uAC00 \uC774\uBBF8 \uC54C\uC544.",
      /* @__PURE__ */ jsx("b", { children: "\uC77C\uACF1 \uC774\uC0C1 \uB9DE\uC73C\uBA74" }),
      " \uB098\uBA38\uC9C0\uB3C4 \uCC38\uACE0\uD560 \uB9CC\uD558\uACE0, ",
      /* @__PURE__ */ jsx("b", { children: "\uC5EC\uC12F \uC774\uD558\uBA74 \uC811\uC5B4 \uB46C." })
    ] }),
    r.checks.map(([q, w], i) => /* @__PURE__ */ jsxs("div", { className: "impck", children: [
      /* @__PURE__ */ jsx("i", {}),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("b", { children: q }),
        /* @__PURE__ */ jsx("p", { children: w })
      ] })
    ] }, i)),
    r.noHour && /* @__PURE__ */ jsxs("p", { className: "impmsg", children: [
      "\uD0DC\uC5B4\uB09C ",
      /* @__PURE__ */ jsx("b", { children: "\uC2DC(\u6642)\uB97C \uBAB0\uB77C" }),
      " \uB124 \uC790\uB9AC \uC911 \uD558\uB098\uAC00 \uBE44\uC5C8\uC5B4. \uC2DC\uC5D0 \uAC78\uB9B0 \uAC74 \uBABB \uC77D\uC5C8\uB2E4\uACE0 \uBD10\uC57C \uD574."
    ] }),
    !r.given.city && /* @__PURE__ */ jsxs("p", { className: "impmsg", children: [
      "\uD0DC\uC5B4\uB09C ",
      /* @__PURE__ */ jsx("b", { children: "\uB3C4\uC2DC\uB97C \uBAB0\uB77C" }),
      " \uC11C\uC6B8 \uAE30\uC900\uC73C\uB85C \uC77D\uC5C8\uC5B4. \uB2E4\uB978 \uC9C0\uC5ED\uC774\uBA74 \uC2DC(\u6642)\uC640 \uAC89\uBAA8\uC2B5\uC774 \uD55C \uCE78 \uC62E\uACA8\uAC08 \uC218 \uC788\uC5B4."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "impfoot", children: [
      /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => {
        setNotesOn((v) => !v);
        track("imprint_notes_toggled", { on: !notesOn });
      }, children: notesOn ? "\u25B4 \uADFC\uAC70 \uC811\uAE30" : `\u25BE \uADFC\uAC70 \uBCF4\uAE30 \u2014 ${r.notes.length}\uAC1C` }),
      notesOn && /* @__PURE__ */ jsx("ol", { className: "impnotes", children: r.notes.map((t, i) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("span", { children: i + 1 }),
        /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: t } })
      ] }, i)) }),
      /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: onClose, children: "\uB2EB\uC744\uAC8C" })
    ] })
  ] });
}
function MyeongsikReport({ saju, sex, birth }) {
  if (!saju || !saju.idx) return null;
  return /* @__PURE__ */ jsx(MyeongsikReportBody, { saju, sex, birth });
}
function MyeongsikReportBody({ saju, sex, birth }) {
  const [open, setOpen] = useState(true);
  const idx = saju.idx;
  const now = /* @__PURE__ */ new Date();
  const dist = Object.entries(sipseongDist(idx)).sort((a, b) => b[1] - a[1]);
  const cutV = dist.length > 3 ? dist[2][1] : 0;
  const top = dist.filter(([, v], i) => i < 3 || v === cutV);
  const grp = (ks) => dist.filter(([k]) => ks.includes(k)).reduce((a, [, v]) => a + v, 0);
  const support = grp(["\uBE44\uACAC", "\uAC81\uC7AC", "\uC815\uC778", "\uD3B8\uC778"]);
  const strength = support >= 4 ? "\uC2E0\uAC15" : support <= 2 ? "\uC2E0\uC57D" : "\uC911\uAC04";
  const ys = yongsin(idx, saju.counts, strength);
  const GRP5 = { "\uB098\uB97C \uBC1B\uCE58\uB294 \uD798": ["\uBE44\uACAC", "\uAC81\uC7AC"], "\uD45C\uD604\xB7\uCC3D\uC791": ["\uC2DD\uC2E0", "\uC0C1\uAD00"], "\uC7AC\uBB3C": ["\uC815\uC7AC", "\uD3B8\uC7AC"], "\uC870\uC9C1\xB7\uC790\uB9AC": ["\uC815\uAD00", "\uD3B8\uAD00"], "\uBC30\uC6C0\xB7\uBC1B\uB294 \uBCF5": ["\uC815\uC778", "\uD3B8\uC778"] };
  const lackSS = Object.entries(GRP5).filter(([, ks]) => grp(ks) === 0).map(([n]) => n);
  const lackEl = Object.entries(saju.counts).filter(([, v]) => v === 0).map(([k]) => k);
  const sins = sinsalOf(idx);
  const se = seun(idx.dG, now.getFullYear(), 5);
  const ladder = [];
  if (sex && birth && birth.y) {
    try {
      for (let a = 1; a <= 71; a += 10) {
        const du = daeun(+birth.y, +birth.m, +birth.d, birth.noHour ? 12 : +birth.h, birth.noHour || birth.min === "" ? 0 : +birth.min, !!birth.noHour, cityLon(birth.city), sex === "M", +birth.y + a - 1);
        if (du && !du.pre && !ladder.some((x) => x.startAge === du.startAge)) ladder.push(du);
      }
    } catch (_) {
    }
  }
  const nowAge = birth && birth.y ? now.getFullYear() - +birth.y + 1 : null;
  const bornYet = !(birth && birth.y && new Date(+birth.y, (+birth.m || 1) - 1, +birth.d || 1) > now);
  const tk = bornYet ? taekil(idx, now) : { good: [], bad: [] };
  const jael = grp(["\uC815\uC7AC", "\uD3B8\uC7AC"]);
  const child = sex ? grp(sex === "M" ? ["\uC815\uAD00", "\uD3B8\uAD00"] : ["\uC2DD\uC2E0", "\uC0C1\uAD00"]) : null;
  const SS10 = ["\uBE44\uACAC", "\uAC81\uC7AC", "\uC2DD\uC2E0", "\uC0C1\uAD00", "\uC815\uC7AC", "\uD3B8\uC7AC", "\uC815\uAD00", "\uD3B8\uAD00", "\uC815\uC778", "\uD3B8\uC778"];
  const restSS = SS10.filter((k) => !top.some(([tk2]) => tk2 === k)).map((k) => [k, dist.find(([d]) => d === k)?.[1] || 0]);
  const unread = [];
  if (idx.hG == null) unread.push(["\uD0DC\uC5B4\uB09C \uC2DC", "\uC2DC(\u6642)\uAE30\uB465\uC774 \uBE44\uC5B4 \u2014 \uC2ED\uC131 \uB458\uACFC \uC2DC\uC5D0 \uAC78\uB9B0 \uC2E0\uC0B4\uC744 \uBABB \uC7A1\uC558\uC5B4"]);
  if (!sex) unread.push(["\uC131\uBCC4", "\uB300\uC6B4\uC758 \uBC29\uD5A5(\uC21C\uD589\xB7\uC5ED\uD589)\uC774 \uC548 \uC11C\uC11C 10\uB144 \uD750\uB984\uC744 \uBABB \uD3BC\uCCE4\uC5B4"]);
  if (!birth?.city) unread.push(["\uD0DC\uC5B4\uB09C \uB3C4\uC2DC", "\uC11C\uC6B8 \uACBD\uB3C4\uB85C \uACC4\uC0B0\uD588\uC5B4 \u2014 \uB2E4\uB978 \uC9C0\uC5ED\uC774\uBA74 \uC2DC(\u6642)\uAC00 \uD55C \uCE78 \uC62E\uACA8\uAC08 \uC218 \uC788\uC5B4"]);
  if (!bornYet) unread.push(["\uC544\uC9C1 \uC624\uC9C0 \uC54A\uC740 \uB0A0", "\uD0DC\uC5B4\uB098\uAE30 \uC804\uC774\uB77C '\uC88B\uC740 \uB0A0 \uACE0\uB974\uAE30'\uB294 \uBE90\uC5B4"]);
  const doms = lifeDomains({
    idx,
    ssn: sipseongDist(idx),
    counts: saju.counts,
    strength,
    ys,
    sins,
    lackEl,
    ladder,
    nowAge,
    sex,
    hasHour: idx.hG != null
  });
  useEffect(() => {
    track("report_shown", { sinsal: sins.length, top_ss: dist[0] ? dist[0][0] : null, strength, lack_el: lackEl.join("") || null, yong: ys.eokbu.join("") || null, yong_agree: ys.agree });
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "msr", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("button", { className: "msrbtn", onClick: () => setOpen(!open), children: open ? "\u25B4 \uD0C0\uACE0\uB09C \uADF8\uB987 \uC811\uAE30" : "\u25BE \uD0C0\uACE0\uB09C \uADF8\uB987 \u2014 \uBA85\uC2DD \uAE4A\uC774 \uBCF4\uAE30" }),
    open && /* @__PURE__ */ jsxs("div", { className: "msrbody", children: [
      /* @__PURE__ */ jsxs("p", { className: "cfleg", children: [
        /* @__PURE__ */ jsx(Cf, { k: "h" }),
        "\uACC4\uC0B0\uC5D0\uC11C \uADF8\uB300\uB85C \uB098\uC628 \uAC12 ",
        /* @__PURE__ */ jsx(Cf, { k: "m" }),
        "\uBCF4\uB294 \uB208\uC5D0 \uB530\uB77C \uAC08\uB9B4 \uC218 \uC788\uB294 \uD480\uC774 ",
        /* @__PURE__ */ jsx(Cf, { k: "l" }),
        "\uC7AC\uBBF8\uB85C \uACC1\uB4E4\uC774\uB294 \uC774\uC57C\uAE30"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uAC01\uC778 \u2014 \uD0DC\uC5B4\uB09C \uC21C\uAC04\uC5D0 \uBC15\uD78C \uC5EC\uB35F \uC790\uB9AC ",
        /* @__PURE__ */ jsx(Cf, { k: "h" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "msrp", children: ["\uB144", "\uC6D4", "\uC77C", "\uC2DC"].map((k) => /* @__PURE__ */ jsxs("span", { className: k === "\uC77C" ? "msrpi me" : "msrpi", children: [
        /* @__PURE__ */ jsx("i", { children: k }),
        /* @__PURE__ */ jsx("b", { children: saju.pillars[k] })
      ] }, k)) }),
      /* @__PURE__ */ jsxs("p", { className: "dim", children: [
        "\uB144=\uBFCC\uB9AC\xB7\uC870\uC0C1 \xB7 \uC6D4=\uBD80\uBAA8\xB7\uC0AC\uD68C \xB7 ",
        /* @__PURE__ */ jsx("b", { children: "\uC77C=\uB098\xB7\uBC30\uC6B0\uC790" }),
        " \xB7 \uC2DC=\uC790\uC2DD\xB7\uB9D0\uB144"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          "\uB108 \uC790\uC2E0 ",
          saju.dayGan,
          " \xB7 ",
          EL_KO[saju.main]
        ] }),
        " \u2014 ",
        EL_READ[saju.main],
        " ",
        /* @__PURE__ */ jsx("span", { className: "dim", children: "\uC5EC\uB35F \uC790\uB9AC \uC911 '\uC77C'\uC758 \uC717\uAE00\uC790\uAC00 \uB108 \uC790\uC2E0\uC774\uACE0, \uB098\uBA38\uC9C0\uB294 \uB124\uAC00 \uB193\uC778 \uD658\uACBD\uC774\uC57C" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "bars", children: Object.entries(saju.counts).map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "bar", children: [
        /* @__PURE__ */ jsx("span", { children: k }),
        /* @__PURE__ */ jsx("i", { style: { width: `${v * 14}%`, background: EL_COLOR[k][0] } }),
        /* @__PURE__ */ jsx("b", { children: v })
      ] }, k)) }),
      /* @__PURE__ */ jsxs("p", { className: "dim", children: [
        "\uACC4\uC808\uC758 \uACBD\uACC4\uB294 \uD0DC\uC591\uC758 \uC2E4\uC81C \uC704\uCE58\uB97C \uC9C1\uC811 \uACC4\uC0B0\uD574\uC11C \uAC08\uB790\uACE0, \uB0A0\uC9DC\uB294 \uCC9C\uBB38 \uD45C\uC900\uC73C\uB85C \uBF51\uC544. ",
        /* @__PURE__ */ jsx("b", { children: "\uB300\uC870 \uAC80\uC99D 28\uAC74" }),
        "\uC744 \uD1B5\uACFC\uD55C \uAC12\uC774\uC57C",
        saju.tstAdj != null ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " \xB7 \uD0DC\uC5B4\uB09C \uC2DC\uAC01\uC740 ",
          /* @__PURE__ */ jsxs("b", { children: [
            saju.tstAdj >= 0 ? "+" : "\u2212",
            Math.abs(saju.tstAdj),
            "\uBD84 \uBCF4\uC815"
          ] }),
          "\uD588\uC5B4",
          birth && birth.city ? ` (${birth.city}\uC5D0\uC11C \uD574\uAC00 \uC2E4\uC81C\uB85C \uB0A8\uC911\uD558\uB294 \uC2DC\uAC01 \uAE30\uC900)` : " (\uC11C\uC6B8\uC5D0\uC11C \uD574\uAC00 \uC2E4\uC81C\uB85C \uB0A8\uC911\uD558\uB294 \uC2DC\uAC01 \uAE30\uC900)"
        ] }) : ""
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uC77D\uC9C0 \uBABB\uD55C \uAC83 ",
        /* @__PURE__ */ jsx(Cf, { k: "h" })
      ] }),
      unread.length > 0 ? unread.map(([k, why]) => /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: k }),
        " \u2014 ",
        why
      ] }, k)) : /* @__PURE__ */ jsxs("p", { children: [
        "\uC5C6\uC5B4. \uC5EC\uB35F \uAE00\uC790\uC640 \uB300\uC6B4\uAE4C\uC9C0 ",
        /* @__PURE__ */ jsx("b", { children: "\uC804\uBD80 \uC77D\uD614\uC5B4" }),
        " \u2014 \uC544\uB798\uB294 \uBE60\uC9C4 \uAC83 \uC5C6\uC774 \uACC4\uC0B0\uB41C \uAC12\uC774\uC57C"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uB124 \uC0B6\uC758 \uC790\uB9AC \u2014 \uC544\uD649 \uACF3 ",
        /* @__PURE__ */ jsx(Cf, { k: "m" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "dim", children: [
        "\uC790\uB9AC\uB9C8\uB2E4 \uB137\uC73C\uB85C \uB098\uB220 \uC801\uC5C8\uC5B4 \u2014 ",
        /* @__PURE__ */ jsx("b", { children: "\uCC98\uC74C\uC5D0 \uC5B4\uB5BB\uAC8C \uC0C8\uACA8\uC84C\uB294\uC9C0, \uADF8\uB798\uC11C \uC790\uB77C\uBA70 \uC5B4\uB5BB\uAC8C \uB098\uD0C0\uB0AC\uB294\uC9C0, \uC9C0\uAE08 \uB124\uAC00 \uC5B4\uB514\uC5D0 \uC788\uB294\uC9C0, \uC55E\uC73C\uB85C \uC5B4\uB5BB\uAC8C \uB418\uB294\uC9C0." })
      ] }),
      doms.map((d) => /* @__PURE__ */ jsxs("div", { className: "dom", children: [
        /* @__PURE__ */ jsxs("p", { className: "domh", children: [
          d.t,
          " ",
          /* @__PURE__ */ jsx(Cf, { k: d.cf })
        ] }),
        d.s.map(([lab, txt]) => (
          /* Em 이 만드는 조각들을 반드시 한 겹으로 싸야 한다 —
             .dstep 이 flex 라, 안 싸면 조각 하나하나가 열이 되어 글이 세로로 찢어진다(실측) */
          /* @__PURE__ */ jsxs("p", { className: "dstep", children: [
            /* @__PURE__ */ jsx("i", { children: lab }),
            /* @__PURE__ */ jsx("span", { className: "dt", children: /* @__PURE__ */ jsx(Em, { t: txt }) })
          ] }, lab)
        ))
      ] }, d.k)),
      !sex && /* @__PURE__ */ jsxs("p", { className: "msrsub", children: [
        "\uC5F0\uC560\xB7\uC790\uB140 \uB450 \uC790\uB9AC\uB294 ",
        /* @__PURE__ */ jsx("b", { children: "\uC131\uBCC4\uC774 \uC788\uC5B4\uC57C" }),
        " \uC5B4\uB290 \uAE00\uC790\uAC00 \uADF8 \uC778\uC5F0\uC778\uC9C0 \uAC08\uB824 \u2014 \uD504\uB85C\uD544\uC5D0 \uB354\uD558\uBA74 \uC544\uD649 \uC790\uB9AC\uAC00 \uB2E4 \uC5F4\uB824"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uC148\uC758 \uADFC\uAC70 \u2014 \uC704 \uC544\uD649 \uC790\uB9AC\uAC00 \uC5B4\uB514\uC11C \uB098\uC654\uB098 ",
        /* @__PURE__ */ jsx(Cf, { k: "h" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uD0C0\uACE0\uB09C \uAC83 ",
        /* @__PURE__ */ jsx(Cf, { k: "h" })
      ] }),
      top.map(([k, v]) => /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          SS_KO[k],
          " ",
          v
        ] }),
        " \u2014 ",
        SS_TIP[k].e,
        /* @__PURE__ */ jsxs("span", { className: "msr3", children: [
          /* @__PURE__ */ jsx("i", { children: "\uC2E4\uC81C\uB85C\uB294" }),
          " ",
          SS_TIP[k].r,
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("i", { children: "\uADF8\uB298" }),
          " ",
          SS_TIP[k].s
        ] })
      ] }, k)),
      restSS.length > 0 && /* @__PURE__ */ jsxs("p", { className: "msrsub", children: [
        /* @__PURE__ */ jsx("b", { children: "\uADF8 \uBC16\uC758 \uC790\uB9AC\uB4E4" }),
        " \u2014 ",
        restSS.map(([k, v]) => `${SS_KO[k]} ${v}`).join(" \xB7 "),
        " ",
        /* @__PURE__ */ jsx("span", { className: "dim", children: "\uAC1C\uC218\uAC00 \uC801\uC744\uC218\uB85D \uADF8 \uC601\uC5ED\uC740 \uC774\uBC88 \uC0DD\uC5D0 \uB35C \uC950\uACE0 \uD0DC\uC5B4\uB0AC\uB2E4\uB294 \uB73B\uC774\uC57C" })
      ] }),
      jael >= 2 && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          "\uC7AC\uBB3C \uC790\uB9AC ",
          jael
        ] }),
        " \u2014 \uC7AC\uBB3C\uC774 \uCC98\uC74C\uBD80\uD130 \uC2E4\uB824 \uC788\uC5B4. \uD750\uB984\uC774 \uC5F4\uB9B4 \uB54C \uD06C\uAC8C \uBC1B\uB294 \uADF8\uB987\uC774\uC57C"
      ] }),
      child != null && child >= 1 && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uC790\uC2DD \uC778\uC5F0" }),
        " \u2014 \uC544\uC774 \uBCF5\uC774 \uCC98\uC74C\uBD80\uD130 \uB4E4\uC5B4 \uC788\uC5B4"
      ] }),
      sins.map((x) => /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: SIN_KO[x.name] || x.name }),
        " ",
        /* @__PURE__ */ jsx(Cf, { k: "l" }),
        " \u2014 ",
        x.tip
      ] }, x.name)),
      (lackSS.length > 0 || lackEl.length > 0) && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uBE44\uC5B4 \uC788\uB294 \uC790\uB9AC" }),
        " \u2014 ",
        [...lackEl.map((e) => `${EL_KO[e]}\uC758 \uAE30\uC6B4`), ...lackSS].join(" \xB7 "),
        ". \uC5C6\uB294 \uAC74 \uD760\uC774 \uC544\uB2C8\uB77C \uCC44\uC6B0\uB294 \uC790\uB9AC\uC57C",
        lackEl.length ? " \u2014 \uADF8 \uAE30\uC6B4\uC774 \uB4E4\uC5B4\uC624\uB294 \uB54C\uB97C \uC544\uB798 \uD750\uB984\uC5D0\uC11C \uBD10" : ""
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uD798\uC758 \uC800\uC6B8" }),
        " ",
        /* @__PURE__ */ jsx(Cf, { k: "m" }),
        " \u2014 ",
        STR_KO[strength],
        " \xB7 \uB108\uB97C \uBC1B\uCE58\uB294 \uAE00\uC790 ",
        support,
        "\uAC1C ",
        /* @__PURE__ */ jsx("span", { className: "dim", children: "(\uAC04\uC774 \uD310\uC815: \uBC1B\uCE58\uB294 \uAE00\uC790 4\uAC1C \uC774\uC0C1\uC774\uBA74 \uBBF8\uB294 \uCABD \xB7 2\uAC1C \uC774\uD558\uBA74 \uBC1B\uCCD0\uC918\uC57C \uD558\uB294 \uCABD)" }),
        strength === "\uC2E0\uC57D" ? " \u2014 \uADF8\uB987\uBCF4\uB2E4 \uD314 \uD798\uC774 \uB2A6\uAC8C \uBD99\uB294 \uBAB8\uC774\uC57C. \uBC1B\uCCD0\uC8FC\uB294 \uD750\uB984\uC774 \uC62C \uB54C \uD06C\uAC8C \uBC1B\uC544" : strength === "\uC2E0\uAC15" ? " \u2014 \uC81C \uD798\uC73C\uB85C \uBBF8\uB294 \uBAB8\uC774\uC57C. \uC4F8 \uACF3(\uC77C\xB7\uD45C\uD604)\uC774 \uC5F4\uB9B4 \uB54C \uD480\uB824" : ""
      ] }),
      ys.eokbu.length > 0 && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uCC44\uC6B8 \uAE30\uC6B4" }),
        " ",
        /* @__PURE__ */ jsx(Cf, { k: "m" }),
        " \u2014 ",
        ys.eokbu.map((e) => EL_KO[e]).join("\xB7"),
        ys.agree ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " ",
          /* @__PURE__ */ jsxs("span", { className: "dim", children: [
            "(\uD798\uC758 \uC800\uC6B8\uACFC \uACC4\uC808(",
            ys.season,
            ") \uB450 \uBC29\uBC95\uC774 \uAC19\uC740 \uB2F5)"
          ] })
        ] }) : ys.johu.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " \xB7 \uACC4\uC808(",
          ys.season,
          ")\uB85C \uBCF4\uBA74 ",
          ys.johu.map((e) => EL_KO[e]).join("\xB7"),
          " ",
          /* @__PURE__ */ jsx("span", { className: "dim", children: "\u2014 \uB450 \uBC29\uBC95\uC774 \uAC08\uB824. \uBCF4\uB294 \uB208\uC5D0 \uB530\uB77C \uB2F5\uC774 \uB2EC\uB77C\uC9C0\uB294 \uC790\uB9AC\uC57C" })
        ] }) : "",
        ". \uC774 \uAE30\uC6B4\uC774 \uB4E4\uC5B4\uC624\uB294 \uB54C\uAC00 \uB124 \uACC4\uC808\uC774\uC57C"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uD750\uB984 ",
        /* @__PURE__ */ jsx(Cf, { k: "h" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "dim", children: [
        "\uCE78\uC758 \uAE00\uC790\uB294 \uACC4\uC0B0\uC5D0\uC11C \uADF8\uB300\uB85C \uB098\uC628 \uAC12\uC774\uACE0, \uADF8\uAC8C ",
        /* @__PURE__ */ jsx("b", { children: "\uC5B4\uB5A4 \uAE30\uC6B4\uC778\uC9C0" }),
        "\uB97C \uC77D\uB294 \uBD80\uBD84\uC774 \uAC08\uB9B4 \uC218 \uC788\uB294 \uD480\uC774\uC57C"
      ] }),
      ladder.length > 0 && ladder.map((du) => {
        const ss = sipseong(idx.dG, GAN.indexOf(du.ganji[0]));
        const isNow = nowAge != null && nowAge >= du.startAge && nowAge <= du.endAge;
        const isYong = ys.eokbu.includes(du.el);
        const fills = lackEl.includes(du.el);
        return /* @__PURE__ */ jsxs("p", { className: isYong ? "msrkey" : "", children: [
          /* @__PURE__ */ jsxs("b", { children: [
            du.startAge,
            "~",
            du.endAge,
            "\uC138 ",
            du.ganji
          ] }),
          " \u2014 ",
          SS_KO[ss],
          " \xB7 ",
          EL_KO[du.el],
          isYong ? " \xB7 \uCC44\uC6B8 \uAE30\uC6B4\uC774 \uB4E4\uC5B4\uC624\uB294 \uAD6C\uAC04 \u2605" : fills ? " \xB7 \uBE44\uC5B4 \uC788\uB358 " + EL_KO[du.el] + "\uAC00 \uCC44\uC6CC\uC9C0\uB294 \uAD6C\uAC04" : "",
          isNow ? " \u25C2 \uC9C0\uAE08" : ""
        ] }, du.startAge);
      }),
      ladder.length === 0 && /* @__PURE__ */ jsx("p", { className: "dim", children: "\uC5F4 \uD574 \uB2E8\uC704 \uD070 \uD750\uB984\uC740 \uC131\uBCC4\uC774 \uC788\uC5B4\uC57C \uBC29\uD5A5\uC774 \uC11C \u2014 \uD504\uB85C\uD544\uC5D0 \uC131\uBCC4\uC744 \uB354\uD558\uBA74 \uC5EC\uB4E0\uAE4C\uC9C0 \uD3BC\uCCD0\uC904\uAC8C" }),
      se.map((x) => /* @__PURE__ */ jsxs("p", { className: "msrsub", children: [
        /* @__PURE__ */ jsxs("b", { children: [
          x.year,
          " ",
          x.ganji
        ] }),
        " \u2014 ",
        SS_KO[x.ss],
        "\uC758 \uD574",
        x.ss === "\uC815\uC7AC" || x.ss === "\uD3B8\uC7AC" ? " \xB7 \uC7AC\uBB3C\uC774 \uC6C0\uC9C1\uC5EC" : x.ss === "\uC815\uAD00" || x.ss === "\uD3B8\uAD00" ? " \xB7 \uC790\uB9AC\xB7\uBA85\uC608\uAC00 \uAC78\uB824" : x.ss === "\uBE44\uACAC" || x.ss === "\uAC81\uC7AC" ? " \xB7 \uACBD\uC7C1\xB7\uAD6C\uC124 \uC870\uC2EC" : ""
      ] }, x.year)),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uC0AC\uB78C ",
        /* @__PURE__ */ jsx(Cf, { k: "m" })
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          "\uC9DD\uC758 \uC790\uB9AC \u2014 ",
          SPOUSE[sipseong(idx.dG, JI_BONGI[idx.dJ])]
        ] }),
        " ",
        /* @__PURE__ */ jsx(Cf, { k: "m" })
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          "\uBD80\uB52A\uD788\uB294 \uB760 ",
          TTI[(idx.yJ + 6) % 12],
          "\uB760 \xB7 \uAEC4\uB044\uB7EC\uC6B4 \uB760 ",
          TTI[WONJIN[idx.yJ]],
          "\uB760"
        ] }),
        " ",
        /* @__PURE__ */ jsx(Cf, { k: "l" }),
        " \u2014 \uBBF8\uC6CC\uD558\uB780 \uAC8C \uC544\uB2C8\uB77C, \uD070\uB3C8\xB7\uBCF4\uC99D\uB9CC \uC870\uC2EC\uD558\uB780 \uB73B\uC774\uC57C"
      ] }),
      bornYet && /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uB0A0 ",
        /* @__PURE__ */ jsx(Cf, { k: "l" })
      ] }),
      bornYet && (tk.good.length ? /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uC88B\uC740 \uB0A0" }),
        " \u2014 ",
        tk.good.map((d) => d.label).join(" \xB7 "),
        tk.bad.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " / ",
          /* @__PURE__ */ jsx("b", { children: "\uD53C\uD560 \uB0A0" }),
          " \u2014 ",
          tk.bad.map((d) => d.label).join(" \xB7 ")
        ] }) : null
      ] }) : /* @__PURE__ */ jsx("p", { children: "\uC774\uBC88 \uB2EC\uC5D4 \uD2B9\uBCC4\uD788 \uAC00\uB9AC\uB294 \uB0A0 \uC5C6\uC74C" })),
      /* @__PURE__ */ jsxs("p", { className: "msrh", children: [
        "\uC77C ",
        /* @__PURE__ */ jsx(Cf, { k: "m" })
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsxs("b", { children: [
          EL_KO[GAN_EL[idx.dG]],
          "\uC758 \uAE30\uC6B4"
        ] }),
        " \u2014 ",
        JOB_EL[GAN_EL[idx.dG]]
      ] }),
      ys.eokbu.length > 0 && EL_USE[ys.eokbu[0]] && /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\uACC1\uC5D0 \uB450\uBA74 \uC88B\uC740 \uAC83" }),
        " \u2014 ",
        ys.eokbu.map((e) => `${EL_KO[e]}: ${EL_USE[e].color}\xB7${EL_USE[e].dir}`).join(" / "),
        " ",
        /* @__PURE__ */ jsxs("span", { className: "dim", children: [
          "\xB7 \uC774\uB984 \uC18C\uB9AC\uB85C\uB294 ",
          ys.eokbu.map((e) => EL_USE[e].sound).join(", ")
        ] })
      ] })
    ] })
  ] });
}
const ganjiIdx = (g, j) => {
  for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === j) return i;
  return 0;
};
function daeun(y, m, d, h, mi, hourUnknown, lon, isMale, nowY) {
  const jdBirth = jdFromKST(y, m, d, hourUnknown ? 12 : h, hourUnknown ? 0 : mi || 0);
  const lam = sunLongitude(jdBirth);
  const beforeIpchun = m <= 2 && !(lam >= 315);
  const sy = beforeIpchun ? y - 1 : y;
  const yG = ((sy - 4) % 10 + 10) % 10;
  const mn = Math.floor((lam - 315 + 360) % 360 / 30) + 1;
  const mJ = (mn + 1) % 12, mG = (yG % 5 * 2 + 2 + (mn - 1)) % 10;
  const mIdx = ganjiIdx(mG, mJ);
  const forward = yG % 2 === 0 === isMale;
  const seg0 = Math.floor((lam - 315 + 360) % 360 / 30);
  let j = jdBirth, days = 15;
  for (let i = 0; i < 1800; i++) {
    j += forward ? 0.02 : -0.02;
    if (Math.floor((sunLongitude(j) - 315 + 360) % 360 / 30) !== seg0) {
      days = Math.abs(j - jdBirth);
      break;
    }
  }
  const num = Math.max(1, Math.min(10, Math.round(days / 3)));
  const age = nowY - y + 1;
  const dir = forward ? "\uC21C\uD589" : "\uC5ED\uD589";
  if (age < num) return { pre: true, num, dir };
  const step = Math.floor((age - num) / 10) + 1;
  const idx = ((mIdx + (forward ? step : -step)) % 60 + 60) % 60;
  const startAge = num + (step - 1) * 10;
  return { pre: false, ganji: GAN[idx % 10] + JI[idx % 12], el: GAN_EL[idx % 10], startAge, endAge: startAge + 9, num, dir };
}
const ZODIAC = [
  ["\uC5FC\uC18C\uC790\uB9AC", 1, 19, "\uD759"],
  ["\uBB3C\uBCD1\uC790\uB9AC", 2, 18, "\uACF5\uAE30"],
  ["\uBB3C\uACE0\uAE30\uC790\uB9AC", 3, 20, "\uBB3C"],
  ["\uC591\uC790\uB9AC", 4, 19, "\uBD88"],
  ["\uD669\uC18C\uC790\uB9AC", 5, 20, "\uD759"],
  ["\uC30D\uB465\uC774\uC790\uB9AC", 6, 21, "\uACF5\uAE30"],
  ["\uAC8C\uC790\uB9AC", 7, 22, "\uBB3C"],
  ["\uC0AC\uC790\uC790\uB9AC", 8, 22, "\uBD88"],
  ["\uCC98\uB140\uC790\uB9AC", 9, 22, "\uD759"],
  ["\uCC9C\uCE6D\uC790\uB9AC", 10, 23, "\uACF5\uAE30"],
  ["\uC804\uAC08\uC790\uB9AC", 11, 22, "\uBB3C"],
  ["\uC0AC\uC218\uC790\uB9AC", 12, 21, "\uBD88"],
  ["\uC5FC\uC18C\uC790\uB9AC", 12, 31, "\uD759"]
];
const ZO_READ = { \uBD88: "\uD0C0\uC624\uB974\uB294 \uBCC4 \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC5B4. \uB9DD\uC124\uC784\uBCF4\uB2E4 \uD6C4\uD68C\uB97C \uBB34\uC11C\uC6CC\uD558\uB294 \uBCC4\uC774\uC57C.", \uD759: "\uB2E8\uB2E8\uD55C \uBCC4 \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC9C0. \uD655\uC2E4\uD55C \uAC83\uB9CC \uB51B\uACE0 \uC2F6\uC5B4\uD558\uB294 \uBC1C\uC744 \uC54C\uC544.", \uACF5\uAE30: "\uBC14\uB78C\uC758 \uBCC4\uC774\uC57C. \uC0DD\uAC01\uC774 \uB9CE\uC544 \uC5B4\uB514\uB85C\uB4E0 \uAC08 \uC218 \uC788\uB294 \uB9CC\uD07C, \uC5B4\uB514\uB85C \uAC08\uC9C0 \uB298 \uACE0\uBBFC\uC774\uC9C0.", \uBB3C: "\uBB3C\uC758 \uBCC4 \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC5B4. \uB9C8\uC74C\uC774 \uAE4A\uC5B4\uC11C, \uC595\uC740 \uB2F5\uC5D0\uB294 \uB9CC\uC871 \uBABB \uD558\uB294 \uC0AC\uB78C." };
const EL_TRAIT = { \uAE08: "\uD55C\uBC88 \uB9C8\uC74C\uC744 \uC815\uD558\uBA74 \uB204\uAD6C\uBCF4\uB2E4 \uB2E8\uB2E8\uD55C", \uC218: "\uAE4A\uC774 \uC0DD\uAC01\uD558\uACE0, \uB9C8\uC74C\uB3C4 \uADF8\uB9CC\uD07C \uAE4A\uC740", \uD654: "\uB9C8\uC74C\uC5D0 \uBD88\uC774 \uBD99\uC73C\uBA74 \uB204\uAD6C\uBCF4\uB2E4 \uB728\uAC70\uC6B4", \uBAA9: "\uBA48\uCD94\uC9C0 \uC54A\uACE0 \uACC4\uC18D \uC790\uB77C\uACE0 \uC2F6\uC5B4\uD558\uB294", \uD1A0: "\uACC1\uC744 \uC870\uC6A9\uD788, \uB4E0\uB4E0\uD558\uAC8C \uBC1B\uCCD0\uC8FC\uB294" };
const ZO_FLAW = { \uACF5\uAE30: "\uC0DD\uAC01\uC774 \uB9CE\uC544 \uAE38 \uC704\uC5D0\uC11C \uD754\uB4E4\uB9AC", \uBD88: "\uAE09\uD55C \uB9C8\uC74C\uC5D0 \uC2A4\uC2A4\uB85C \uB370\uC774\uAE30\uB3C4 \uD558", \uBB3C: "\uB9C8\uC74C\uC774 \uAE4A\uC5B4 \uD63C\uC790 \uAC00\uB77C\uC549\uAE30\uB3C4 \uD558", \uD759: "\uD655\uC2E4\uD55C \uAC83\uB9CC \uCC3E\uB2E4 \uC81C\uC790\uB9AC\uC5D0 \uBA38\uBB3C\uAE30\uB3C4 \uD558" };
const MOON_DRIVE = { \uC0C1\uD604\uB2EC: "'\uC870\uAE08 \uB354'\uB97C \uD5A5\uD574 \uCC28\uC624\uB974\uB294", \uBCF4\uB984\uB2EC: "\uC228\uC9C0 \uC54A\uACE0 \uBE5B\uB098\uB824\uB294", \uCD08\uC2B9\uB2EC: "\uC0C8\uB85C \uC2DC\uC791\uD558\uAE30\uB97C \uB450\uB824\uC6CC\uD558\uC9C0 \uC54A\uB294", \uC0C8\uB2EC: "\uBE48 \uACF3\uC744 \uC2A4\uC2A4\uB85C \uCC44\uC6CC\uAC00\uB294", "\uCC28\uC624\uB974\uB294 \uB2EC": "\uC644\uC131\uC744 \uD5A5\uD574 \uB098\uC544\uAC00\uB294", "\uAE30\uC6B0\uB294 \uB2EC": "\uBE44\uC6B8 \uC904 \uC544\uB294", \uD558\uD604\uB2EC: "\uB35C\uC5B4\uB0B4\uBA70 \uB610\uB837\uD574\uC9C0\uB294", \uADF8\uBBD0\uB2EC: "\uB05D\uC5D0\uC11C \uB2E4\uC2DC \uC2DC\uC791\uD558\uB294" };
const getZodiac = (m, d) => {
  for (const [n, zm, zd, el] of ZODIAC) if (m < zm || m === zm && d <= zd) return { name: n, el };
  return { name: "\uC5FC\uC18C\uC790\uB9AC", el: "\uD759" };
};
function moonPhase(y, m, d) {
  const age = ((jdn(y, m, d) - 2451550) % 29.53059 + 29.53059) % 29.53059;
  const ph = age < 1.8 ? ["\uC0C8\uB2EC", "\uBE44\uC5B4 \uC788\uB358 \uD558\uB298"] : age < 6.5 ? ["\uCD08\uC2B9\uB2EC", "\uB9C9 \uCC28\uC624\uB974\uAE30 \uC2DC\uC791\uD55C \uB2EC"] : age < 9.5 ? ["\uC0C1\uD604\uB2EC", "\uBC18\uCBE4 \uCC28\uC624\uB978 \uB2EC"] : age < 13.5 ? ["\uCC28\uC624\uB974\uB294 \uB2EC", "\uAC70\uC758 \uAC00\uB4DD\uD55C \uB2EC"] : age < 16.5 ? ["\uBCF4\uB984\uB2EC", "\uAC00\uC7A5 \uBC1D\uC740 \uB2EC"] : age < 21 ? ["\uAE30\uC6B0\uB294 \uB2EC", "\uCC9C\uCC9C\uD788 \uB0B4\uB824\uB193\uB294 \uB2EC"] : age < 24.5 ? ["\uD558\uD604\uB2EC", "\uBC18\uC744 \uBE44\uC6CC\uB0B8 \uB2EC"] : ["\uADF8\uBBD0\uB2EC", "\uB2E4\uC74C\uC744 \uC900\uBE44\uD558\uB294 \uB2EC"];
  const read = {
    \uC0C8\uB2EC: "\uB124\uAC00 \uD0DC\uC5B4\uB09C \uBC24, \uD558\uB298\uC740 \uBE44\uC5B4 \uC788\uC5C8\uC5B4. \uCC44\uC6B0\uB294 \uAC74 \uB298 \uB124 \uBAAB\uC774\uC5C8\uC9C0.",
    \uCD08\uC2B9\uB2EC: "\uCC28\uC624\uB974\uAE30 \uC2DC\uC791\uD55C \uB2EC \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC5B4. \uC2DC\uC791\uC758 \uAE30\uC6B4\uC774 \uB124 \uC548\uC5D0 \uC788\uC5B4.",
    \uC0C1\uD604\uB2EC: "\uBC18\uCBE4 \uCC28\uC624\uB978 \uB2EC\uCC98\uB7FC, \uB108\uB294 \uB298 '\uC870\uAE08 \uB354'\uB97C \uD5A5\uD574 \uC788\uB294 \uC0AC\uB78C\uC774\uC57C.",
    "\uCC28\uC624\uB974\uB294 \uB2EC": "\uAC70\uC758 \uAC00\uB4DD \uCC2C \uB2EC \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC9C0. \uC644\uC131 \uC9C1\uC804\uC758 \uAE34\uC7A5\uC744 \uC544\uB294 \uC0AC\uB78C.",
    \uBCF4\uB984\uB2EC: "\uAC00\uC7A5 \uBC1D\uC740 \uB2EC\uC774 \uB108\uB97C \uBE44\uCD94\uACE0 \uC788\uC5C8\uC5B4. \uC228\uB294 \uAC74 \uC5B4\uC6B8\uB9AC\uC9C0 \uC54A\uC544.",
    "\uAE30\uC6B0\uB294 \uB2EC": "\uB0B4\uB824\uB193\uC744 \uC904 \uC544\uB294 \uB2EC \uC544\uB798 \uD0DC\uC5B4\uB0AC\uC5B4. \uBE44\uC6B0\uB294 \uAC83\uB3C4 \uACB0\uC815\uC774\uC57C.",
    \uD558\uD604\uB2EC: "\uBC18\uC744 \uBE44\uC6CC\uB0B8 \uB2EC\uCC98\uB7FC, \uB108\uB294 \uB35C\uC5B4\uB0BC \uB54C \uB354 \uB610\uB837\uD574\uC9C0\uB294 \uC0AC\uB78C\uC774\uC9C0.",
    \uADF8\uBBD0\uB2EC: "\uB05D\uACFC \uC2DC\uC791 \uC0AC\uC774\uC758 \uB2EC\uC774\uC57C. \uC804\uD658\uC810\uB9C8\uB2E4 \uB124\uAC00 \uAC15\uD574\uC9C0\uB294 \uC774\uC720."
  };
  return { name: ph[0], sub: ph[1], read: read[ph[0]] };
}
function lifePath(y, m, d) {
  const digits = (n) => String(n).split("").reduce((a, c) => a + +c, 0);
  let s = digits(y) + digits(m) + digits(d);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) s = digits(s);
  return s;
}
const LP_READ = {
  1: "1\uC758 \uAE38 \u2014 \uC55E\uC7A5\uC11C\uC57C \uC0B4\uC544\uB098\uB294 \uC0AC\uB78C. \uB124 \uACB0\uC815\uC740 \uB0A8\uC774 \uB300\uC2E0 \uBABB \uD574.",
  2: "2\uC758 \uAE38 \u2014 \uD568\uAED8\uC77C \uB54C \uAC15\uD574\uC9C0\uB294 \uC0AC\uB78C. \uD63C\uC790 \uC815\uD558\uB824\uB2C8 \uBB34\uAC70\uC6E0\uB358 \uAC70\uC57C.",
  3: "3\uC758 \uAE38 \u2014 \uD45C\uD604\uD558\uBA70 \uAE38\uC744 \uCC3E\uB294 \uC0AC\uB78C. \uB9D0\uB85C \uAEBC\uB0B4\uBA74 \uB2F5\uC774 \uBCF4\uC774\uACE4 \uD588\uC9C0.",
  4: "4\uC758 \uAE38 \u2014 \uC313\uC544\uC62C\uB9AC\uB294 \uC0AC\uB78C. \uAE09\uD55C \uAE38\uBCF4\uB2E4 \uB2E8\uB2E8\uD55C \uAE38\uC774 \uB124 \uAE38\uC774\uC57C.",
  5: "5\uC758 \uAE38 \u2014 \uBCC0\uD654\uAC00 \uC228\uD1B5\uC778 \uC0AC\uB78C. \uAC07\uD78C \uAE30\uBD84\uC774 \uB4E4\uBA74 \uADF8\uAC8C \uC2E0\uD638\uC57C.",
  6: "6\uC758 \uAE38 \u2014 \uB3CC\uBCF4\uB294 \uC0AC\uB78C. \uB0A8 \uCC59\uAE30\uB2E4 \uB124 \uACB0\uC815\uC774 \uB2A6\uC5B4\uC9C0\uB294 \uAC83\uB3C4 \uBD24\uC5B4.",
  7: "7\uC758 \uAE38 \u2014 \uD30C\uACE0\uB4DC\uB294 \uC0AC\uB78C. \uB0A9\uB4DD\uC774 \uC548 \uB418\uBA74 \uBAB8\uC774 \uC548 \uC6C0\uC9C1\uC774\uC9C0.",
  8: "8\uC758 \uAE38 \u2014 \uC774\uB904\uB0B4\uB294 \uC0AC\uB78C. \uD06C\uAC8C \uADF8\uB9AC\uB294 \uAC78 \uB450\uB824\uC6CC\uD558\uC9C0 \uB9C8.",
  9: "9\uC758 \uAE38 \u2014 \uD488\uC774 \uB113\uC740 \uC0AC\uB78C. \uB05D\uB9FA\uC74C\uC774 \uC0C8 \uC2DC\uC791\uC778 \uAC78 \uC544\uB294 \uC0AC\uB78C.",
  11: "11\uC758 \uAE38 \u2014 \uC9C1\uAC10\uC774 \uBA3C\uC800 \uC544\uB294 \uC0AC\uB78C. \uADF8 \uCD09, \uBB34\uC2DC\uD558\uC9C0 \uB9C8.",
  22: "22\uC758 \uAE38 \u2014 \uD06C\uAC8C \uC9D3\uB294 \uC0AC\uB78C. \uB124 \uACC4\uD68D\uC740 \uD5C8\uD669\uC774 \uC544\uB2C8\uB77C \uC124\uACC4\uC57C.",
  33: "33\uC758 \uAE38 \u2014 \uC0AC\uB78C\uC744 \uC0B4\uB9AC\uB294 \uC0AC\uB78C. \uADF8\uB9CC\uD07C \uB124 \uBAAB\uB3C4 \uCC59\uACA8\uC57C \uD574."
};
const VALUES16 = ["\uC548\uC815", "\uC131\uC7A5", "\uC790\uC720", "\uC778\uC815", "\uAD00\uACC4", "\uC131\uCDE8", "\uC990\uAC70\uC6C0", "\uC758\uBBF8", "\uB3C8", "\uAC74\uAC15", "\uC6A9\uAE30", "\uBAA8\uD5D8", "\uCC3D\uC870", "\uD3C9\uC628", "\uC544\uB984\uB2E4\uC6C0", "\uBAB0\uC785"];
function biorhythm(y, m, d) {
  const days = (Date.now() - new Date(y, m - 1, d).getTime()) / 864e5;
  const f = (p) => Math.round(Math.sin(2 * Math.PI * (days / p)) * 100);
  return { body: f(23), emotion: f(28), intellect: f(33) };
}
function samjae(yJ, nowY) {
  const grp = [[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]];
  const tri = [[2, 3, 4], [8, 9, 10], [11, 0, 1], [5, 6, 7]];
  const gi = grp.findIndex((a) => a.includes(yJ));
  const pos = tri[gi].indexOf(((nowY - 4) % 12 + 12) % 12);
  return pos === -1 ? null : ["\uB4E4\uC0BC\uC7AC", "\uB20C\uC0BC\uC7AC", "\uB0A0\uC0BC\uC7AC"][pos];
}
const LUNAR = { 1900: [693626, 8, [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30]], 1901: [694010, 0, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 1902: [694364, 0, [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30]], 1903: [694719, 5, [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30]], 1904: [695102, 0, [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29]], 1905: [695456, 0, [30, 30, 29, 30, 30, 29, 29, 30, 29, 30, 29, 30]], 1906: [695811, 4, [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 1907: [696195, 0, [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29]], 1908: [696549, 0, [30, 29, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30]], 1909: [696904, 2, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30]], 1910: [697288, 0, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 1911: [697642, 6, [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30]], 1912: [698026, 0, [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30]], 1913: [698380, 0, [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30]], 1914: [698734, 5, [30, 30, 29, 30, 30, 29, 29, 30, 29, 30, 29, 29, 30]], 1915: [699118, 0, [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 1916: [699473, 0, [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29]], 1917: [699827, 2, [30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29]], 1918: [700211, 0, [30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30]], 1919: [700566, 7, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 1920: [700950, 0, [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30]], 1921: [701304, 0, [30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30]], 1922: [701658, 5, [30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30]], 1923: [702042, 0, [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30]], 1924: [702396, 0, [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29]], 1925: [702750, 4, [30, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]], 1926: [703135, 0, [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 1927: [703489, 0, [30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 1928: [703844, 2, [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 30]], 1929: [704228, 0, [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30]], 1930: [704582, 6, [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29]], 1931: [704965, 0, [30, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29]], 1932: [705319, 0, [30, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30]], 1933: [705674, 5, [29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30]], 1934: [706058, 0, [29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30]], 1935: [706413, 0, [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 1936: [706767, 3, [30, 29, 29, 30, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 1937: [707151, 0, [30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29]], 1938: [707505, 7, [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30]], 1939: [707889, 0, [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 1940: [708243, 0, [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 1941: [708597, 6, [30, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 1942: [708981, 0, [30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 29, 30]], 1943: [709336, 0, [29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30]], 1944: [709691, 4, [29, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 1945: [710075, 0, [29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30]], 1946: [710429, 0, [30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30]], 1947: [710783, 2, [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30]], 1948: [711167, 0, [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 1949: [711521, 7, [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 1950: [711905, 0, [30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 1951: [712259, 0, [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 1952: [712614, 5, [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30]], 1953: [712998, 0, [29, 30, 29, 29, 30, 30, 29, 30, 30, 29, 30, 30]], 1954: [713353, 0, [29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30]], 1955: [713707, 3, [30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30]], 1956: [714091, 0, [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30]], 1957: [714445, 8, [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30]], 1958: [714829, 0, [29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 1959: [715183, 0, [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]], 1960: [715537, 6, [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]], 1961: [715921, 0, [30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]], 1962: [716276, 0, [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 1963: [716630, 4, [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 1964: [717014, 0, [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30]], 1965: [717369, 0, [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30]], 1966: [717723, 3, [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29]], 1967: [718106, 0, [30, 30, 29, 30, 30, 29, 29, 30, 29, 30, 29, 30]], 1968: [718461, 7, [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 1969: [718845, 0, [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29]], 1970: [719199, 0, [30, 29, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30]], 1971: [719554, 5, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30]], 1972: [719938, 0, [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 1973: [720292, 0, [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30, 29]], 1974: [720646, 4, [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30]], 1975: [721030, 0, [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30]], 1976: [721384, 8, [30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30]], 1977: [721768, 0, [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29]], 1978: [722122, 0, [30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29]], 1979: [722477, 6, [30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29]], 1980: [722861, 0, [30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 1981: [723216, 0, [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30]], 1982: [723570, 4, [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30]], 1983: [723954, 0, [30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30]], 1984: [724308, 10, [30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30]], 1985: [724692, 0, [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30]], 1986: [725046, 0, [29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29]], 1987: [725400, 6, [30, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]], 1988: [725785, 0, [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 1989: [726139, 0, [30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 1990: [726494, 5, [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 30]], 1991: [726878, 0, [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30]], 1992: [727232, 0, [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30]], 1993: [727586, 3, [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 1994: [727969, 0, [30, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30]], 1995: [728324, 8, [29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30]], 1996: [728708, 0, [29, 30, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30]], 1997: [729063, 0, [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 1998: [729417, 5, [30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 30, 29]], 1999: [729801, 0, [30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29]], 2e3: [730155, 0, [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29]], 2001: [730509, 4, [30, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 2002: [730893, 0, [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 2003: [731247, 0, [30, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30]], 2004: [731602, 2, [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 2005: [731986, 0, [29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 29]], 2006: [732340, 7, [30, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30]], 2007: [732725, 0, [29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30]], 2008: [733079, 0, [30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30]], 2009: [733433, 5, [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30]], 2010: [733817, 0, [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 2011: [734171, 0, [30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 2012: [734525, 3, [30, 29, 30, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29]], 2013: [734909, 0, [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30]], 2014: [735264, 9, [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]], 2015: [735648, 0, [29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30, 29]], 2016: [736002, 0, [30, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30]], 2017: [736357, 5, [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30]], 2018: [736741, 0, [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30]], 2019: [737095, 0, [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 2020: [737449, 4, [30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30]], 2021: [737833, 0, [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]], 2022: [738187, 0, [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30]], 2023: [738542, 2, [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]], 2024: [738926, 0, [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29]], 2025: [739280, 6, [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29]], 2026: [739664, 0, [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30]], 2027: [740019, 0, [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30]], 2028: [740373, 5, [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29]], 2029: [740756, 0, [30, 30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 30]], 2030: [741111, 0, [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]] };
const ordOf = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 864e5) + 719163;
function solar2lunar(y, m, d) {
  const ord = ordOf(y, m, d);
  for (let ly = y; ly >= y - 1; ly--) {
    const rec = LUNAR[ly];
    if (!rec) continue;
    let off = ord - rec[0];
    if (off < 0) continue;
    const leap = rec[1], ms = rec[2];
    for (let i = 0; i < ms.length; i++) {
      if (off < ms[i]) {
        let mm = i + 1, isLeap = false;
        if (leap > 0) {
          if (i + 1 === leap + 1) {
            mm = leap;
            isLeap = true;
          } else if (i + 1 > leap) mm = i;
        }
        return { ly, lm: mm, ld: off + 1, isLeap };
      }
      off -= ms[i];
    }
  }
  return null;
}
function lunar2solarOrd(ly, lm, ld) {
  const rec = LUNAR[ly];
  if (!rec) return null;
  const leap = rec[1], ms = rec[2];
  let off = 0;
  for (let i = 0; i < ms.length; i++) {
    let mm = i + 1;
    if (leap > 0 && i + 1 > leap) mm = i;
    const isLeapSlot = leap > 0 && i + 1 === leap + 1;
    if (mm === lm && !isLeapSlot) return rec[0] + off + ld - 1;
    off += ms[i];
  }
  return null;
}
function lunar2solar(ly, lm, ld, wantLeap) {
  const rec = LUNAR[ly];
  if (!rec) return null;
  const leap = rec[1], ms = rec[2];
  let off = 0;
  for (let i = 0; i < ms.length; i++) {
    let mm = i + 1, isLeapSlot = false;
    if (leap > 0) {
      if (i + 1 === leap + 1) {
        mm = leap;
        isLeapSlot = true;
      } else if (i + 1 > leap) mm = i;
    }
    if (mm === lm && isLeapSlot === !!wantLeap) {
      if (ld < 1 || ld > ms[i]) return null;
      const ord = rec[0] + off + (ld - 1);
      const dt = new Date((ord - 719163) * 864e5);
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    }
    off += ms[i];
  }
  return null;
}
function tojung(by, bm, bd, nowY) {
  const lb = solar2lunar(by, bm, bd);
  if (!lb) return null;
  const age = nowY - lb.ly + 1;
  const GS = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];
  const TJ = [11, 13, 10, 10, 13, 9, 9, 13, 12, 12, 13, 11];
  const WJ = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
  const IJ = [9, 11, 8, 8, 11, 7, 7, 11, 10, 10, 11, 9];
  const yG = ((nowY - 4) % 10 + 10) % 10, yJb = ((nowY - 4) % 12 + 12) % 12;
  const sang = (age + GS[yG] + TJ[yJb]) % 8 || 8;
  const rec = LUNAR[nowY];
  if (!rec) return null;
  const leap = rec[1], ms = rec[2];
  let days = 0;
  for (let i = 0; i < ms.length; i++) {
    let mm = i + 1;
    if (leap > 0 && i + 1 > leap) mm = i;
    const isL = leap > 0 && i + 1 === leap + 1;
    if (mm === lb.lm && !isL) {
      days = ms[i];
      break;
    }
  }
  if (!days) return null;
  const mG = (yG % 5 * 2 + 2 + (lb.lm - 1)) % 10, mJb = (lb.lm + 1) % 12;
  const jung = (GS[mG] + WJ[mJb] + days) % 6 || 6;
  const ld = Math.min(lb.ld, days);
  const ordD = lunar2solarOrd(nowY, lb.lm, ld);
  if (ordD == null) return null;
  const g = ((ordD + 1721425 + 49) % 60 + 60) % 60;
  const ha = (GS[g % 10] + IJ[g % 12] + ld) % 3 || 3;
  return { code: sang * 100 + jung * 10 + ha, sang, jung, ha, lunar: `${lb.lm}\uC6D4 ${lb.ld}\uC77C${lb.isLeap ? "(\uC724\uB2EC)" : ""}` };
}
const TRI_EL = { "111": "\uCC9C", "110": "\uD0DD", "101": "\uD654", "100": "\uB8B0", "011": "\uD48D", "010": "\uC218", "001": "\uC0B0", "000": "\uC9C0" };
const HEX_NAMES = {
  \uCC9C\uCC9C: "\uC911\uCC9C\uAC74",
  \uCC9C\uD0DD: "\uCC9C\uD0DD\uB9AC",
  \uCC9C\uD654: "\uCC9C\uD654\uB3D9\uC778",
  \uCC9C\uB8B0: "\uCC9C\uB8B0\uBB34\uB9DD",
  \uCC9C\uD48D: "\uCC9C\uD48D\uAD6C",
  \uCC9C\uC218: "\uCC9C\uC218\uC1A1",
  \uCC9C\uC0B0: "\uCC9C\uC0B0\uB3C8",
  \uCC9C\uC9C0: "\uCC9C\uC9C0\uBE44",
  \uD0DD\uCC9C: "\uD0DD\uCC9C\uCF8C",
  \uD0DD\uD0DD: "\uC911\uD0DD\uD0DC",
  \uD0DD\uD654: "\uD0DD\uD654\uD601",
  \uD0DD\uB8B0: "\uD0DD\uB8B0\uC218",
  \uD0DD\uD48D: "\uD0DD\uD48D\uB300\uACFC",
  \uD0DD\uC218: "\uD0DD\uC218\uACE4",
  \uD0DD\uC0B0: "\uD0DD\uC0B0\uD568",
  \uD0DD\uC9C0: "\uD0DD\uC9C0\uCDCC",
  \uD654\uCC9C: "\uD654\uCC9C\uB300\uC720",
  \uD654\uD0DD: "\uD654\uD0DD\uADDC",
  \uD654\uD654: "\uC911\uD654\uB9AC",
  \uD654\uB8B0: "\uD654\uB8B0\uC11C\uD569",
  \uD654\uD48D: "\uD654\uD48D\uC815",
  \uD654\uC218: "\uD654\uC218\uBBF8\uC81C",
  \uD654\uC0B0: "\uD654\uC0B0\uB824",
  \uD654\uC9C0: "\uD654\uC9C0\uC9C4",
  \uB8B0\uCC9C: "\uB1CC\uCC9C\uB300\uC7A5",
  \uB8B0\uD0DD: "\uB1CC\uD0DD\uADC0\uB9E4",
  \uB8B0\uD654: "\uB1CC\uD654\uD48D",
  \uB8B0\uB8B0: "\uC911\uB8B0\uC9C4",
  \uB8B0\uD48D: "\uB1CC\uD48D\uD56D",
  \uB8B0\uC218: "\uB1CC\uC218\uD574",
  \uB8B0\uC0B0: "\uB1CC\uC0B0\uC18C\uACFC",
  \uB8B0\uC9C0: "\uB1CC\uC9C0\uC608",
  \uD48D\uCC9C: "\uD48D\uCC9C\uC18C\uCD95",
  \uD48D\uD0DD: "\uD48D\uD0DD\uC911\uBD80",
  \uD48D\uD654: "\uD48D\uD654\uAC00\uC778",
  \uD48D\uB8B0: "\uD48D\uB8B0\uC775",
  \uD48D\uD48D: "\uC911\uD48D\uC190",
  \uD48D\uC218: "\uD48D\uC218\uD658",
  \uD48D\uC0B0: "\uD48D\uC0B0\uC810",
  \uD48D\uC9C0: "\uD48D\uC9C0\uAD00",
  \uC218\uCC9C: "\uC218\uCC9C\uC218",
  \uC218\uD0DD: "\uC218\uD0DD\uC808",
  \uC218\uD654: "\uC218\uD654\uAE30\uC81C",
  \uC218\uB8B0: "\uC218\uB8B0\uB454",
  \uC218\uD48D: "\uC218\uD48D\uC815",
  \uC218\uC218: "\uC911\uC218\uAC10",
  \uC218\uC0B0: "\uC218\uC0B0\uAC74",
  \uC218\uC9C0: "\uC218\uC9C0\uBE44",
  \uC0B0\uCC9C: "\uC0B0\uCC9C\uB300\uCD95",
  \uC0B0\uD0DD: "\uC0B0\uD0DD\uC190",
  \uC0B0\uD654: "\uC0B0\uD654\uBE44",
  \uC0B0\uB8B0: "\uC0B0\uB8B0\uC774",
  \uC0B0\uD48D: "\uC0B0\uD48D\uACE0",
  \uC0B0\uC218: "\uC0B0\uC218\uBABD",
  \uC0B0\uC0B0: "\uC911\uC0B0\uAC04",
  \uC0B0\uC9C0: "\uC0B0\uC9C0\uBC15",
  \uC9C0\uCC9C: "\uC9C0\uCC9C\uD0DC",
  \uC9C0\uD0DD: "\uC9C0\uD0DD\uB9BC",
  \uC9C0\uD654: "\uC9C0\uD654\uBA85\uC774",
  \uC9C0\uB8B0: "\uC9C0\uB8B0\uBCF5",
  \uC9C0\uD48D: "\uC9C0\uD48D\uC2B9",
  \uC9C0\uC218: "\uC9C0\uC218\uC0AC",
  \uC9C0\uC0B0: "\uC9C0\uC0B0\uACB8",
  \uC9C0\uC9C0: "\uC911\uC9C0\uACE4"
};
const hexName = (lines) => {
  const bit = (v) => v % 2 ? "1" : "0";
  const lo = lines.slice(0, 3).map(bit).join(""), up = lines.slice(3).map(bit).join("");
  return HEX_NAMES[TRI_EL[up] + TRI_EL[lo]];
};
const EL_COLOR = { \uC218: ["#2a6bd4", "#7fd4ff", "#0a1f4d"], \uD654: ["#e04d2a", "#ffb36b", "#3d0f0a"], \uBAA9: ["#2ab06b", "#a8f0c0", "#0a3d22"], \uAE08: ["#8fb0e6", "#e8f2ff", "#1d2436"], \uD1A0: ["#c98f3d", "#ffe9ad", "#3d2a0a"] };
const ZO_ORDER = ["\uC591\uC790\uB9AC", "\uD669\uC18C\uC790\uB9AC", "\uC30D\uB465\uC774\uC790\uB9AC", "\uAC8C\uC790\uB9AC", "\uC0AC\uC790\uC790\uB9AC", "\uCC98\uB140\uC790\uB9AC", "\uCC9C\uCE6D\uC790\uB9AC", "\uC804\uAC08\uC790\uB9AC", "\uC0AC\uC218\uC790\uB9AC", "\uC5FC\uC18C\uC790\uB9AC", "\uBB3C\uBCD1\uC790\uB9AC", "\uBB3C\uACE0\uAE30\uC790\uB9AC"];
const FORM_STEPS = ["\uC0AC\uC8FC \uC5EC\uB35F \uAE00\uC790\uB97C \uC138\uB294 \uC911", "\uB2EC\uC758 \uC790\uB9AC\uB97C \uB9DE\uCD94\uB294 \uC911", "\uBCC4\uC790\uB9AC\uB97C \uD3EC\uAC1C\uB294 \uC911", "\uD0C0\uACE0\uB09C \uACB0\uC744 \uC77D\uB294 \uC911", "\uC218(\u6578)\uC758 \uC6B8\uB9BC\uC744 \uB4E3\uB294 \uC911", "\uD750\uB984\uC744 \uC9DA\uC5B4 \uB9E4\uB4ED\uC9D3\uB294 \uC911"];
const QHINTS = ["\uBC24 11\uC2DC, \uC804\uB0A8\uCE5C\uC5D0\uAC8C \uCE74\uD1A1 \uBCF4\uB0BC\uAE4C?", "\uBC1B\uC740 \uC774\uC9C1 \uC81C\uC548, \uC218\uB77D\uD560\uAE4C?", "\uC774 \uC0AC\uC5C5 \uC9C0\uAE08 \uC2DC\uC791\uD574\uB3C4 \uB420\uAE4C?", "3\uB144 \uC0AC\uADC4 \uC0AC\uB78C\uC774\uB791 \uACB0\uD63C\uD574\uB3C4 \uB420\uAE4C?", "\uC9C0\uAE08 \uC774 \uD68C\uC0AC \uADF8\uB9CC\uB458\uAE4C?", "3\uC8FC\uC9F8 \uB2F5 \uC5C6\uB294 \uC378, \uD55C \uBC88 \uB354 \uC5F0\uB77D\uD560\uAE4C?", "\uC624\uB298 \uC800\uB141 \uBB50 \uBA39\uC9C0?", "\uBB34\uB9AC\uD574\uC11C \uC774 \uC9D1 \uACC4\uC57D\uD560\uAE4C?", "\uC9C0\uAE08 \uACE0\uBC31\uD574\uB3C4 \uB420\uAE4C?", "\uC774 \uAD00\uACC4, \uACC4\uC18D \uC774\uC5B4\uAC00\uB3C4 \uB420\uAE4C?"];
const ZODIAC_ANIMAL = ["\uC950", "\uC18C", "\uD638\uB791\uC774", "\uD1A0\uB07C", "\uC6A9", "\uBC40", "\uB9D0", "\uC591", "\uC6D0\uC22D\uC774", "\uB2ED", "\uAC1C", "\uB3FC\uC9C0"];
const WISP_GAIT = ["\uC885\uC885\uAC70\uB9AC\uB2E4 \uB2E4\uB2E4\uB2E5 \uB0B4\uB2EC\uB9B4", "\uB290\uAE0B\uD558\uAC8C \uB69C\uBC85\uB69C\uBC85 \uAC78\uC744", "\uC228\uC8FD\uC600\uB2E4 \uB36E\uCE58\uB4EF \uB6F0\uC5B4\uC624\uB97C", "\uAE61\uCDA9\uAE61\uCDA9 \uB6F0\uC5B4\uB2E4\uB2D0", "\uAE38\uAC8C \uAD7D\uC774\uCE58\uBA70 \uD5E4\uC5C4\uCE60", "\uC2A4\uB974\uB974 \uBBF8\uB044\uB7EC\uC9C8", "\uBC14\uB78C\uCC98\uB7FC \uB0B4\uB2EC\uB9B4", "\uCD1D\uCD1D \uB6F0\uB2E4 \uD3F4\uC9DD \uC606\uAC78\uC74C\uC9C8\uD560", "\uADF8\uB124 \uD0C0\uB4EF \uD719\uD719 \uBC29\uD5A5\uC744 \uBC14\uAFC0", "\uCF55\uCF55 \uCABC\uB2E4 \uD478\uB4DC\uB355\uAC70\uB9B4", "\uB2EC\uB824\uC654\uB2E4 \uC800\uB9CC\uCE58 \uAC14\uB2E4 \uD560", "\uB4A4\uB6B1\uB4A4\uB6B1 \uAC78\uC744"];
function _hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function _hslToHex(h, s, l) {
  h = (h % 360 + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  }, to = (x) => Math.round(f(x) * 255).toString(16).padStart(2, "0");
  return "#" + to(h + 1 / 3) + to(h) + to(h - 1 / 3);
}
const rotHue = (hex, deg) => {
  const [h, s, l] = _hexToHsl(hex);
  return _hslToHex(h + deg, s, l);
};
const seedRnd = (str) => {
  let h = 7;
  for (const c of String(str)) h = h * 31 + c.charCodeAt(0) >>> 0;
  return () => (h = h * 1664525 + 1013904223 >>> 0) / 2 ** 32;
};
function texture(saju, zo, num) {
  if (!saju) return "ISFJ";
  const c = saju.counts || {};
  const yang = (c.\uBAA9 || 0) + (c.\uD654 || 0);
  const eum = (c.\uAE08 || 0) + (c.\uC218 || 0);
  const E = yang >= eum ? "E" : "I";
  const N = ["\uACF5\uAE30", "\uBD88"].includes(zo?.el) ? "N" : "S";
  const T = saju.main === "\uAE08" || saju.main === "\uD1A0" ? "T" : "F";
  const P = (num || 5) % 2 ? "P" : "J";
  return E + N + T + P;
}
function GuardianCanvas({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const tx = mbti || texture(saju, zo, num);
    const E = tx[0] === "E", N = tx[1] === "N", T = tx[2] === "T", P = tx[3] === "P";
    const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.\uC77C || ""}`;
    const srnd = seedRnd(seedStr);
    const _b = birth || {};
    const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
    const tzSign = ((_nn + 19) % 20 + 20) % 20;
    const tzTone = ((_nn + 3) % 13 + 13) % 13 + 1;
    const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));
    const nayFreq = 0.4 + nayinIdx % 10 * 0.14, nayAmp = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
    let nakIdx = 0, duEl = null;
    try {
      const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour);
      nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra));
    } catch (_) {
    }
    try {
      if (_b.sex) {
        const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", (/* @__PURE__ */ new Date()).getFullYear());
        if (_du && !_du.pre) duEl = _du.el;
      }
    } catch (_) {
    }
    const form = saju.main;
    const [b1, b2] = EL_COLOR[saju.main];
    const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
    const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
    const c1 = rotHue(b1, zoDeg), c2 = rotHue(b2, zoDeg);
    const _order = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const subEl = _order.find((e) => e !== saju.main) || saju.main;
    const accent = rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5);
    const lp = num || 5, arms = 3 + (lp - 1) % 5;
    const n = E ? 4200 : 3200, speed = P ? 1.15 : 0.78, chaos = T ? 0.6 : 1.35;
    const MOON_I = { \uC0C8\uB2EC: 0, \uCD08\uC2B9\uB2EC: 1, \uC0C1\uD604\uB2EC: 2, "\uCC28\uC624\uB974\uB294 \uB2EC": 3, \uBCF4\uB984\uB2EC: 4, "\uAE30\uC6B0\uB294 \uB2EC": 3, \uD558\uD604\uB2EC: 2, \uADF8\uBBD0\uB2EC: 1 };
    const lum = 0.55 + (MOON_I[moon?.name] ?? 2) * 0.11;
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.42 * (E ? 1.06 : 0.9);
    const ps = Array.from({ length: n }, (_, i) => {
      const sa = srnd() * Math.PI * 2, sr = R * (1.1 + srnd() * 0.9);
      const arm = Math.floor(srnd() * arms);
      const sx = cx + Math.cos(sa) * sr, sy = cy + Math.sin(sa) * sr;
      return {
        u: srnd(),
        v: srnd(),
        o: arm + srnd() * 0.6,
        s: srnd(),
        arm,
        ph: srnd() * Math.PI * 2,
        sx,
        sy,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        dly: srnd() * 0.35,
        acc: srnd() < 0.24
      };
    });
    let t = 0, raf, lastHeavy = 0;
    const born = performance.now();
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const place = (p) => {
      const g = 0.6 + 0.4 * Math.sin(t * 1.2 + p.ph);
      if (form === "\uD654") {
        const rise = (p.v + t * 0.12 * (0.5 + p.s)) % 1;
        const armX = (p.arm - (arms - 1) / 2) / Math.max(arms, 1);
        const sway = Math.sin(rise * 6 + t * 2 + p.ph) * (0.5 - Math.abs(p.u - 0.5)) * R * 0.5;
        return [cx + armX * R * 1.5 + (p.u - 0.5) * R * 0.42 * (1 - rise * 0.6) + sway, cy + R * 0.95 - rise * R * 2.1, 1 - rise];
      }
      if (form === "\uC218") {
        const band = (p.arm - (arms - 1) / 2) / Math.max(arms, 1);
        return [cx + (p.u - 0.5) * R * 2.1, cy + band * R * 1.55 + (p.v - 0.5) * R * 0.24 + Math.sin(p.u * 8 + t * 1.8 + p.ph) * R * 0.15, g];
      }
      if (form === "\uBAA9") {
        const spread = Math.min(arms, 7), ang2 = -Math.PI / 2 + (p.arm % spread - (spread - 1) / 2) * 0.42 + Math.sin(t + p.ph) * 0.08, len = p.v * R * 1.9;
        return [cx + Math.cos(ang2) * len + Math.sin(p.u * 10 + t) * p.v * R * 0.3, cy + R * 0.6 + Math.sin(ang2) * len, g];
      }
      if (form === "\uAE08") {
        const bw = 0.12 + 0.55 / arms;
        const lead = p.arm === 0 ? 1.16 : 1 - p.arm % 3 * 0.05;
        const ang2 = p.arm / arms * Math.PI * 2 + (p.u - 0.5) * bw + t * 0.15;
        const rr2 = (0.14 + 0.78 * p.v + 0.05 * Math.sin(t * 1.3 + p.ph)) * R * lead;
        return [cx + Math.cos(ang2) * rr2, cy + Math.sin(ang2) * rr2 * 0.94, (0.45 + 0.55 * (1 - p.v)) * (p.arm === 0 ? 1.1 : 1)];
      }
      const ang = p.u * Math.PI * 2;
      const lobe = 1 + 0.24 * Math.cos(arms * (ang + t * 0.12));
      const rr = Math.pow(p.v, 0.5) * R * 0.9 * lobe;
      return [cx + Math.cos(ang + t * 0.15) * rr, cy + Math.sin(ang + t * 0.15) * rr * 0.92, g];
    };
    const draw = () => {
      const nowMs = performance.now();
      const agi = agitateRef && agitateRef.current ? 1 : 0;
      const reacting = reactRef && reactRef.current && nowMs - reactRef.current.t0 < 1800;
      const restMs = restRef && restRef.current ? restRef.current : 0;
      if (restMs && !agi && !reacting && nowMs - lastHeavy < restMs) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastHeavy = nowMs;
      t += 0.01 * speed;
      const age = (nowMs - born) / 1e3;
      const breathe = 0.9 + (0.1 + agi * 0.1) * Math.sin(t * (0.8 + agi * 5));
      let gExpand = 0, gBright = 1;
      if (reactRef && reactRef.current) {
        const rt = (performance.now() - reactRef.current.t0) / 1e3;
        const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18);
        const dir = reactRef.current.dir;
        if (dir === "GO") {
          gExpand = env * 0.5;
          gBright = 1 + env * 0.5;
        } else if (dir === "STOP") {
          gExpand = -env * 0.45;
          gBright = 1 - env * 0.55;
        } else {
          gExpand = env * 0.1 * Math.sin(rt * 5);
          gBright = 1 - env * 0.12;
        }
      }
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${0.1 + agi * 0.06})`;
      ctx.fillRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      const gcy = form === "\uD654" ? cy + R * 0.3 : cy;
      const gr = ctx.createRadialGradient(cx, gcy, 1, cx, gcy, R * 0.62 * breathe);
      gr.addColorStop(0, c2 + "0c");
      gr.addColorStop(0.5, c1 + "07");
      gr.addColorStop(1, "transparent");
      ctx.globalAlpha = 1;
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, gcy, R * 0.62 * breathe, 0, 7);
      ctx.fill();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        let [tx2, ty, depth] = place(p);
        if (gExpand) {
          tx2 = cx + (tx2 - cx) * (1 + gExpand);
          ty = cy + (ty - cy) * (1 + gExpand);
        }
        const k = easeOut(Math.max(0, Math.min(1, (age - p.dly) / 2.4)));
        const fx = Math.sin(p.y * 0.012 + t * 0.9 + p.ph) + Math.sin(p.y * 0.022 - t * 0.6) + Math.sin(t * nayFreq + p.o) * nayAmp;
        const fy = Math.cos(p.x * 0.013 - t * 0.8) + Math.cos(p.x * 0.019 + t * 0.5 + p.ph) + Math.cos(t * nayFreq * 1.1 + p.ph) * nayAmp;
        const flow = (0.16 + 0.55 * (1 - k)) * chaos * (0.5 + p.s);
        const spring = 6e-3 + 0.032 * k;
        const ax = (tx2 - p.x) * spring + fx * flow + (agi ? Math.sin(t * 9 + p.o) * 1.5 : 0);
        const ay = (ty - p.y) * spring + fy * flow + (agi ? Math.cos(t * 8 + p.ph) * 1.5 : 0);
        p.vx = p.vx * 0.9 + ax;
        p.vy = p.vy * 0.9 + ay;
        const sp = Math.hypot(p.vx, p.vy), lim = 3 + agi * 4;
        if (sp > lim) {
          p.vx *= lim / sp;
          p.vy *= lim / sp;
        }
        p.x += p.vx;
        p.y += p.vy;
        const tw = N ? 0.55 + 0.45 * Math.sin(t * 5 + p.o * 7) : 0.9;
        ctx.globalAlpha = Math.max(0, depth) * tw * (0.4 + p.s * 0.5) * (0.3 + 0.7 * k) * lum * gBright;
        ctx.fillStyle = p.acc ? accent : p.o % 3 < 1 ? c2 : c1;
        const r = (0.7 + p.s * 1.1) * (T ? 0.84 : 1.24);
        ctx.fillRect(p.x - r * 0.5, p.y - r * 0.5, r, r);
      }
      if (duEl) {
        const da = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.5 * breathe);
        da.addColorStop(0, EL_COLOR[duEl][0] + "10");
        da.addColorStop(1, "transparent");
        ctx.globalAlpha = 1;
        ctx.fillStyle = da;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.5 * breathe, 0, 7);
        ctx.fill();
      }
      {
        const nodes = 3 + tzSign % 6, rings = 1 + Math.floor((tzTone - 1) / 5), crot = t * (0.28 + tzSign % 4 * 0.14);
        for (let ring = 0; ring < rings; ring++) {
          const rr = R * (0.09 + ring * 0.065);
          for (let kk = 0; kk < nodes; kk++) {
            const a = crot * (ring % 2 ? -1 : 1) + kk / nodes * Math.PI * 2 + tzSign % 5 * 0.31;
            const nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr * 0.96;
            const pz = 2.4 + tzTone * 0.16;
            ctx.globalAlpha = Math.min(0.9, (0.32 + tzTone * 0.028) * (0.6 + 0.4 * Math.sin(t * 2 + kk + ring)) * lum);
            const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, pz);
            ng.addColorStop(0, c2);
            ng.addColorStop(0.5, c1);
            ng.addColorStop(1, "transparent");
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(nx, ny, pz, 0, 7);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return /* @__PURE__ */ jsx("canvas", { ref, "data-renderer": "2d", width: size, height: size, style: { display: "block", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 58%, transparent 88%)", maskImage: "radial-gradient(circle at 50% 50%, #000 58%, transparent 88%)" } });
}
const TUNE = {
  stg: 0.68,
  // 응집 시차 — 손끝으로 모이는 순서(클수록 알알이 늦게 도착)
  starLo: 0.42,
  // 별 아닌 입자의 밝기 하한
  starHi: 1.7,
  // 별 입자의 밝기 상한(대비)
  nE: 34e3,
  // 입자 수 — 외향(E)
  nI: 27e3
  // 입자 수 — 내향(I)
};
const GL_VERT = `
precision highp float;
attribute vec4 a_r0; // x:u y:v z:s w:size\xB7\uC704\uC0C1
attribute vec4 a_r1; // x:ph y:dly z:colorPick w:strandPick
uniform float u_hold,u_beat,u_t,u_form,u_R,u_arms,u_strands,u_twist,u_speed,u_chaos,u_nayF,u_nayA,u_expand,u_agi,u_k,u_ps,u_lum,u_twk,u_psMul,u_focal,u_touchAmt,u_breath,u_trailLive,u_zodiac;
uniform vec2 u_touch,u_touchVel;
uniform vec4 u_trail[10];
varying float v_a; varying float v_pick; varying float v_star;
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
vec2 curl2(vec2 p){ float e=0.12; float x1=vnoise(p+vec2(0.0,e)),x2=vnoise(p-vec2(0.0,e)),y1=vnoise(p+vec2(e,0.0)),y2=vnoise(p-vec2(e,0.0)); return vec2(x1-x2,-(y1-y2))/(2.0*e); }
// \u2500\u2500\u2500 v64 \uB760 \uC815\uB839: 12\uC9C0\uC9C0 \uAC78\uC74C\uAC78\uC774 \uC2DC\uADF8\uB2C8\uCC98. \uB2EB\uD78C\uD615 \uACBD\uB85C(\uC704\uC0C1 \uC6CC\uD551)\uB77C stateless \uC5F0\uC18D \u2500\u2500\u2500
vec2 wispLeader(float tt){
  float zi=u_zodiac;
  float w0=0.3; float th=0.0; vec2 loc=vec2(0.0); float Rorb=0.5;  // v65 \uADA4\uB3C4\uC8FC\uAE30 12s+ \uD14C\uB354\uB9C1(\uBA85\uC0C1 \uC704\uACC4)
  if(zi<0.5){        th=tt*w0*1.3+0.4*sin(tt*1.1)+0.15*sin(tt*4.7+1.3); loc.y+=0.008*sin(tt*21.0); Rorb*=0.94+0.05*sin(tt*3.3); }      // \uC790\xB7\uC950 \uC885\uC885+\uB2E4\uB2E4\uB2E5
  else if(zi<1.5){   th=tt*w0*0.42; loc.y+=-0.012+0.02*abs(sin(tt*0.85)); }                                                            // \uCD95\xB7\uC18C \uB69C\uBC85\uB69C\uBC85
  else if(zi<2.5){   float po=pow(max(0.0,sin(tt*0.42)),8.0); th=tt*w0*0.7+0.85*po; Rorb*=1.0-0.22*po; }                               // \uC778\xB7\uD638\uB791\uC774 \uC7A0\uD589\u2192\uB3C4\uC57D
  else if(zi<3.5){   float hp=fract(tt*0.5); float hop=4.0*hp*(1.0-hp); th=tt*w0*0.9+0.22*hop*sin(hp*3.1416); loc.y+=0.055*hop; }      // \uBB18\xB7\uD1A0\uB07C \uAE61\uCDA9
  else if(zi<4.5){   th=tt*w0*0.55; loc.y+=0.10*sin(th*2.0-tt*1.2); loc.x+=0.05*sin(th*3.0+tt*0.8); }                                  // \uC9C4\xB7\uC6A9 \uAD7D\uC774\uCE68
  else if(zi<5.5){   th=tt*w0*0.75; loc+=vec2(cos(th),sin(th))*0.03*sin(tt*3.4); }                                                     // \uC0AC\xB7\uBC40 \uBBF8\uB044\uB7EC\uC9D0
  else if(zi<6.5){   th=tt*w0*1.7+0.12*sin(tt*2.6); loc.y+=0.022*abs(sin(tt*2.6+0.7)); }                                               // \uC624\xB7\uB9D0 \uC9C8\uC8FC \uCE94\uD130
  else if(zi<7.5){   float cp=pow(0.5+0.5*sin(tt*0.37+2.0),10.0); th=tt*w0*0.8+0.1*sin(tt*2.1); loc.y+=0.02*abs(sin(tt*2.1)); Rorb*=1.0+0.09*cp; } // \uBBF8\xB7\uC591 \uCD1D\uCD1D+\uC606\uD3F4\uC9DD
  else if(zi<8.5){   th=tt*w0+0.95*sin(tt*0.7)+0.25*sin(tt*1.9+0.8); loc.y+=-0.03*abs(cos(tt*1.7)); }                                  // \uC2E0\xB7\uC6D0\uC22D\uC774 \uADF8\uB124 \uC2A4\uC719
  else if(zi<9.5){   float pk=pow(max(0.0,sin(tt*4.2)),6.0)*step(0.2,sin(tt*0.7)); th=tt*w0*0.85+0.05*sin(tt*4.2); loc.y+=-0.05*pk; }  // \uC720\xB7\uB2ED \uCF55\uCF55(\uAC04\uD5D0\xB7\uAE4A\uAC8C)
  else if(zi<10.5){  th=tt*w0*1.4+0.2*sin(tt*0.9); loc.y+=0.018*abs(sin(tt*3.4)); Rorb*=0.8+0.2*sin(tt*0.5); }                         // \uC220\xB7\uAC1C \uACC1\u2194\uC800\uB9CC\uCE58
  else {             th=tt*w0*0.55; loc.x+=0.026*sin(tt*1.3); loc.y+=0.012*abs(sin(tt*2.6)); }                                         // \uD574\xB7\uB3FC\uC9C0 \uB4A4\uB6B1
  return vec2(cos(th),sin(th)*0.82)*Rorb+loc;
}
void main(){
  if(a_r1.w>1.5){                                        // \u2500\u2500 v64 \uB760 \uC815\uB839 \uC704\uC2A4\uD504(\uC120\uB450 1.5%, \uC9C0\uC5F0 \uD3C9\uAC00 \uAF2C\uB9AC) \u2500\u2500
    float zi=u_zodiac;
    float tailLen=(zi>3.5&&zi<4.5)?1.5:((zi>4.5&&zi<5.5)?1.1:0.9);   // \uAF2C\uB9AC\uB97C \uC794\uC0C1 \uC624\uD504\uC14B\uBCF4\uB2E4 \uAE38\uAC8C(\uC810\uC120 \uBC29\uC9C0)
    float lag=pow(a_r0.y,1.6)*tailLen;
    float lg=lag/tailLen;
    float tt=u_t-lag;
    vec2 lead=wispLeader(tt);
    vec2 tang=wispLeader(tt+0.06)-lead;
    tang=tang/max(length(tang),1e-4);
    vec2 nrm=vec2(-tang.y,tang.x);
    float spread=0.012+0.034*lg;
    vec2 body=tang*(a_r0.z-0.5)*spread*1.6+nrm*(a_r0.w-0.5)*spread;
    if(zi>4.5&&zi<5.5) body+=nrm*0.02*sin(u_t*3.4-lg*11.0);
    if(zi>3.5&&zi<4.5) body+=nrm*0.045*sin(u_t*1.6-lg*7.0);
    if(zi>8.5&&zi<9.5){ float flap=pow(0.5+0.5*sin(u_t*0.31),8.0); body*=1.0+1.6*flap; }
    vec2 wp=lead+body;
    float ta0=clamp(u_touchAmt,0.0,1.0);
    float startle=smoothstep(0.05,0.35,ta0)*smoothstep(0.95,0.45,ta0);
    if(zi<0.5||(zi>2.5&&zi<3.5)) wp+=nrm*0.08*startle*sin(u_t*14.0);
    float tg=smoothstep(0.15,0.9,ta0);
    if(zi>9.5&&zi<10.5) tg=smoothstep(0.05,0.5,ta0);
    if(zi>1.5&&zi<2.5) tg=smoothstep(0.45,1.0,ta0);
    wp=mix(wp, u_touch+lead*1.1+body, tg);                           // \uD130\uCE58: \uC740\uD558 \uB9BC \uBC14\uAE65\uC744 \uACF5\uC804
    gl_Position=vec4(wp,0.0,1.0);
    float head=1.0-lg;
    gl_PointSize=u_ps*u_psMul*(0.7+1.3*head*head);                   // \uD06C\uACE0 \uBD80\uB4DC\uB7EC\uC6B4 \uAE00\uB85C\uC6B0(\uD3EC\uD654 \uC2AC\uB7A9 \uBC29\uC9C0)
    float appear=smoothstep(0.78,1.0,u_k);
    float shimmer=0.85+0.15*sin(u_t*2.2+a_r1.x*20.0);
    v_a=(0.14+0.26*head*head)*appear*shimmer*u_lum*(0.82+0.18*u_breath); // \uC704\uACC4 7:3 + \uD638\uD761 \uB3D9\uAE30
    v_pick=-1.0; v_star=1.0;
    return;
  }
  float t=u_t*u_speed;
  float tB=t;
  // v94 \uC2EC\uC7A5\uBC15\uB3D9(\uB7FD-\uB365, ~54bpm) \u2014 \uC0B4\uC544\uC788\uB294 \uAC83\uC73C\uB85C \uC77D\uD788\uAC8C. u_beat=0\uC774\uBA74 \uAEBC\uC9D0

  float strand=floor(a_r1.w*u_strands+0.0001);
  float sOff=strand/max(u_strands,1.0);
  vec2 p; float depth=1.0;
  if(u_form<0.5){ // \uD654 \u2014 \uAF2C\uC5EC \uC624\uB974\uB294 \uB9AC\uBCF8 \uAE30\uB465 (\uAC00\uB2E5 \uD574\uC2DC\uB85C \uC720\uAE30\uD654)
    float sh=fract(sin(strand*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*(0.032+0.022*sh)*(0.5+a_r0.z));
    float y=mix(-1.05,1.05,s);
    float tw=s*u_twist*6.2832+t*(0.18+0.12*sh)+sOff*6.2832+sh*3.1;
    float rad=(0.13+0.1*sin(s*5.0+t*0.45+a_r1.x))*(0.5+0.9*a_r0.x)*(0.7+0.6*sh);
    p=vec2(sin(tw)*rad*2.1+0.16*sin(y*1.6+t*0.14+sh*6.2)+sin(s*3.0+t*0.2+sOff*9.0)*0.12*u_chaos, y);
    depth=0.45+0.55*(0.5+0.5*cos(tw));
    v_a=0.5+0.5*s;
  } else if(u_form<1.5){ // \uC218 \u2014 \uD750\uB974\uB294 \uBB3C\uACB0 \uCE35
    float dir=mod(strand,2.0)<0.5?1.0:-1.0;
    float x=mix(-1.25,1.25,fract(a_r0.x+t*0.03*dir*(0.6+a_r0.z)));
    float band=(sOff-0.5)*1.5;
    p=vec2(x, band+0.11*sin(x*3.6+t*0.55+a_r1.x)+(a_r0.y-0.5)*0.16);
    depth=0.5+0.5*a_r0.z;
    v_a=(1.0-abs(x)*0.45)*0.9;
  } else if(u_form<2.5){ // \uBAA9 \u2014 \uBED7\uC5B4 \uC624\uB974\uB294 \uAC00\uC9C0 \uD750\uB984
    float br=mod(strand,u_arms);
    float ang=1.5708+(br-(u_arms-1.0)*0.5)*0.42+0.05*sin(t*0.35+br*2.0);
    float s=fract(a_r0.y+t*0.035*(0.5+a_r0.z));
    vec2 d=vec2(cos(ang),sin(ang));
    p=vec2((a_r0.x-0.5)*0.62,-0.8)+d*(s*1.8)+vec2(-d.y,d.x)*(a_r0.x-0.5)*(0.12+s*0.55)
      +vec2(sin(s*8.0+t*0.5+a_r1.x),cos(s*7.0-t*0.5))*0.05*s*u_chaos;
    depth=0.5+0.5*(1.0-s);
    v_a=(0.4+0.6*(1.0-s*0.55))*(0.4+0.6*smoothstep(0.0,0.2,s));
  } else if(u_form<3.5){ // \uAE08 \u2014 \uD758\uB7EC\uB0B4\uB9AC\uB294 \uC6A9\uC735 \uAE08\uC18D (\uAC00\uB2E5\uC774 \uAD7D\uC774\uCCD0 \uC3DF\uC544\uC9C0\uBA70 \uC544\uB798\uB85C \uC218\uB834, \uAE08\uC18D \uAD11\uD0DD \uBC18\uC9DD\uC784)
    float str=strand;
    float sh=fract(sin(str*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*0.05*(0.7+0.5*sh));             // \uC704\u2192\uC544\uB798 \uD750\uB984(\uC3DF\uC544\uC9D0)
    float y=mix(1.0,-1.0,s);
    float lane=(str/max(u_strands,1.0)-0.5)*1.1;           // \uAC00\uB2E5 \uBCC4 \uAC00\uB85C \uC704\uCE58
    float coil=sin(y*3.0+str*2.4+t*0.5)*(0.13+0.09*u_twist)*(0.4+0.6*s); // \uD758\uB7EC\uB0B4\uB9AC\uBA70 \uAC10\uAE40
    float x=lane*(1.0-0.35*s)+coil+(a_r0.x-0.5)*0.14;      // \uC544\uB798\uB85C \uAC08\uC218\uB85D \uBAA8\uC784(\uB808\uC778 \uC9C0\uD130\uB85C \uD3C9\uD589 \uC904\uBB34\uB2AC \uC644\uD654)
    p=vec2(x,y);
    depth=0.5+0.5*sh;
    float glint=step(0.93,a_r1.x)*0.7;                     // \uAE08\uC18D \uAD11\uD0DD \uBC18\uC9DD\uC784(\uBC31\uD654 \uC644\uD654)
    v_a=((0.5+0.5*(1.0-abs(x)*0.5))+glint)*smoothstep(0.0,0.07,s)*smoothstep(1.0,0.9,s);
  } else { // \uD1A0 \u2014 \uC911\uC2EC \uC5C6\uB294 \uB09C\uB958 \uC735\uAE30
    float rr=pow(a_r0.z,0.75)*0.88;
    float ang=a_r0.x*6.2832+t*0.05;
    p=vec2(cos(ang),sin(ang)*0.92)*rr;
    p+=u_chaos*0.16*vec2(sin(p.y*2.1+t*0.2+a_r1.x),cos(p.x*1.9-t*0.18+a_r0.y*6.0));
    p+=u_chaos*0.06*vec2(sin(p.y*5.3-t*0.3+a_r0.w*9.0),cos(p.x*4.7+t*0.26+a_r1.x*3.0));
    p*=1.0+0.03*sin(t*0.4);
    depth=0.5+0.5*a_r0.y;
    v_a=0.55+0.45*(1.0-rr*0.7);
  }
  float halo=step(0.84,a_r1.y);                              // v64 \uC131\uAC04 \uBA3C\uC9C0 \uD5E4\uC77C\uB85C(\uC785\uC790 16% \uC7AC\uBC30\uC815)
  if(halo>0.5){
    float hr=0.55+1.05*pow(a_r0.z,0.6);                      // 0.55~1.6 \uAD11\uC5ED \uD0C0\uC6D0 \uC6D0\uBC18
    float ha=a_r0.x*6.2832 + t*(0.05/(0.3+hr));              // \uB290\uB9B0 \uCC28\uB4F1 \uACF5\uC804
    p=vec2(cos(ha),sin(ha)*0.62)*hr;
    depth=0.35+0.3*a_r0.y;
    v_a=0.10+0.10*a_r0.w;                                     // \uBCF8\uCCB4\uC758 ~1/8 \uBC1D\uAE30
  }
  // \u2500\u2500 \uC0B4\uC544\uC788\uB294 \uBC29\uD5A5\uC131 \uD750\uB984 \u2500\u2500 \uB4F1\uBC29\uC131 \uB178\uC774\uC988(\uC9C0\uC9C1) \u2192 \uCF54\uD788\uB7F0\uD2B8 \uCEEC\uB178\uC774\uC988(\uC5F0\uAE30\xB7\uBD88 \uACB0) + \uD615\uD0DC \uBC29\uD5A5
  vec2 fdir = u_form<0.5 ? vec2(0.0,1.0) : u_form<1.5 ? vec2(1.0,0.1) : u_form<2.5 ? vec2(0.15,1.0) : u_form<3.5 ? vec2(0.0,-1.0) : vec2(0.0,0.55); // \uD654 \uC704\xB7\uC218 \uC606\xB7\uBAA9 \uC704\xB7\uAE08 \uC3DF\uC544\uC9D0\xB7\uD1A0 \uD53C\uC5B4\uC624\uB984
  vec2 cflow = curl2(p*1.8 + fdir*(t*0.14) + vec2(0.0, t*0.08));               // \uCF54\uD788\uB7F0\uD2B8 \uD750\uB984\uC7A5(\uACB0\uC774 \uBB49\uCCD0 \uD750\uB984)
  p += (0.034+0.026*u_chaos) * cflow;                                          // \uACB0 \uB530\uB77C \uD750\uB984(\uC800\uC8FC\uD30C \uC9C4\uD3ED \uAC10\uC1E0)
  p += fdir * 0.02 * (0.55+0.45*sin(t*0.3+a_r0.w*6.283));                      // \uD615\uD0DC \uBC29\uD5A5 \uB4DC\uB9AC\uD504\uD2B8
  // \uAD6C\uC2EC\uC810(I/E): I=\uCF54\uC5B4\uB85C \uBAA8\uC784, E=\uC911\uC2EC \uC5C6\uC774 \uD769\uC5B4\uC838 \uB5A0\uB3CE
  p*=mix(1.14,0.9,u_focal);
  p+=(1.0-u_focal)*0.2*smoothstep(0.0,3.5,u_t)*vec2(sin(t*0.24+1.7),sin(t*0.19+0.3));                   // E: \uC624\uD504\uC13C\uD130 \uC720\uB3D9
  float rl=length(p);
  p+=u_nayA*0.055*vec2(sin(t*u_nayF+a_r0.w*6.2832),cos(t*u_nayF*1.1+a_r1.x)); // \uB0A9\uC74C \uACB0
  p+=u_agi*0.05*vec2(sin(t*9.0+a_r0.w*40.0),cos(t*8.0+a_r1.x*40.0));          // \uC758\uC2DD \uC694\uB3D9
  p*=(1.0+u_expand)*(1.0+0.075*u_breath)*u_R;                                   // \uD310\uACB0 \uD33D\uCC3D/\uC218\uCD95 + 9\uCD08 \uC774\uC644 \uD638\uD761(\uC9C0\uBC30 \uBAA8\uB4DC)
  vec2 scat=vec2(cos(a_r1.x*6.2832),sin(a_r1.x*6.2832))*(1.15+a_r0.z*0.75);    // \uC5B4\uC148\uBE14 \uC2DC\uC791\uC810
  float k=clamp((u_k-a_r1.y*0.35)/0.65,0.0,1.0); k=1.0-(1.0-k)*(1.0-k)*(1.0-k);
  p=mix(scat,p,k);
  // \uACF5\uAC04\uAC10: \uC587\uC740 \uBD80\uD53C + \uD615\uD0DC\uBCC4 \uAE30\uC6B8\uAE30(\uC6D0\uBC18=\uD0C0\uC6D0 foreshorten) + \uC88C\uC6B0 \uD754\uB4E4\uB9BC \uC2DC\uCC28 + \uAC15\uD55C \uC6D0\uADFC
  float zc=(a_r0.w-0.5)*0.6+(depth-0.5)*0.3;
  vec3 P=vec3(p,zc);
  float dwr=t*(0.07/(0.35+rl));                              // v64 \uCC28\uB4F1 \uC11C\uD589 \uACF5\uC804(\uC548\uCABD \uBE60\uB974\uACE0 \uBC14\uAE65 \uB290\uB9BC)
  float cwr=cos(dwr), swr=sin(dwr);
  P.xz=mat2(cwr,-swr,swr,cwr)*P.xz;
  if(u_form>3.5){ float d2=dwr*0.6; P.xy=mat2(cos(d2),-sin(d2),sin(d2),cos(d2))*P.xy; } // \uD1A0: \uD654\uBA74\uBA74 \uC18C\uC6A9\uB3CC\uC774 \uAC00\uC0B0
  float ax = u_form<0.5 ? 0.42 : u_form<1.5 ? 0.9 : u_form<2.5 ? 0.46 : u_form<3.5 ? 0.4 : 0.74; // \uD654\xB7\uC218\xB7\uBAA9\xB7\uAE08(\uAE30\uB465)\xB7\uD1A0
  P.yz=mat2(cos(ax),-sin(ax),sin(ax),cos(ax))*P.yz;          // X\uCD95 \uAE30\uC6B8\uAE30
  float ay=0.06*sin(t*0.5);                                  // \uBBF8\uC138 \uC2DC\uCC28(\uCC28\uB4F1 \uACF5\uC804\uC774 \uC2DC\uCC28\uB97C \uB300\uC2E0)
  P.xz=mat2(cos(ay),-sin(ay),sin(ay),cos(ay))*P.xz;
  float dcam=2.4;                                             // \uC6D0\uADFC(\uADFC/\uC6D0 \uD06C\uAE30\uCC28 = \uC785\uCCB4 \uB2E8\uC11C)
  float sc=dcam/(dcam+P.z);
  vec2 spos=P.xy*sc*0.48;
  float ta=clamp(u_touchAmt,0.0,1.0);
  spos+=vec2(sin(t*0.11+1.3)*0.11, sin(t*0.17)*0.07+0.012*u_breath)*(1.0-ta)*smoothstep(0.0,3.5,u_t);   // \uBD80\uC720+\uD638\uD761 \u2014 \uD130\uCE58 \uC911\uC5D4 \uBA48\uCDA4
  float st=a_r1.z*${TUNE.stg};                                             // \uC785\uC790\uBCC4 \uC2DC\uCC28(\uD30C\uB3C4\uC2DD \uB3C4\uCC29 \uC21C\uC11C)
  float g=clamp((ta-st)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);           // v66 \uACE0\uC815 \uBE44\uD589\uCC3D \u2014 \uBAA8\uC784\xB7\uD480\uB9BC \uBAA8\uB450 \uB0B1\uC54C \uD30C\uB3C4\uB85C
  // \u2500\u2500 B\uC0C1\uD0DC: \uC911\uC559\uC810\uC73C\uB85C \uBAA8\uC5EC \uBE5B\uC774 \uBC29\uC0AC\uB85C \uBC1C\uC0B0 (\uBB38\uC591\xB7\uD68C\uC804 \uC5C6\uC74C \u2014 \uC785\uC790\uB2E8\uC704 \uC7AC\uC815\uB82C) \u2500\u2500
  float bang=a_r1.w*6.2832 + (a_r0.y-0.5)*0.22;                     // \uC785\uC790\uBCC4 \uBC29\uC0AC\uAC01(\uB808\uC774)
  float bph=fract(a_r0.z*1.7 + tB*0.55);                            // 0(\uC911\uC2EC)\u21921(\uBC14\uAE65) \uC5F0\uC18D \uBC1C\uC0B0 \uD750\uB984
  // v95 \uBC15\uB3D9\uC744 '\uD30C\uB3D9'\uC73C\uB85C \u2014 \uC911\uC2EC\uC5D0\uC11C \uBC14\uAE65\uC73C\uB85C \uBC88\uC838 \uB098\uAC00\uB294 \uB7FD-\uB365(\uC704\uC0C1\uC774 bph\uB9CC\uD07C \uC9C0\uC5F0)
  float wph=fract(u_t*0.9 - bph*0.85);
  float wave=(exp(-wph*9.0)+0.45*exp(-abs(wph-0.22)*20.0))*u_beat;
  // v96 \uD30C\uBA74\uC774 \uC2DC\uAC04\uC744 \uB450\uACE0 \uBC00\uB824\uB098\uAC04\uB2E4 \u2014 \uCC98\uC74C\uBD80\uD130 \uB05D\uC774 \uBCF4\uC774\uC9C0 \uC54A\uACE0, \uD37C\uC9C0\uBA74\uC11C \uACBD\uACC4\uAC00 \uC0DD\uAE34\uB2E4
  float front=smoothstep(0.0,1.35,u_hold);                          // \uB204\uB978 \uB4A4 ~1.35s\uC5D0 \uAC78\uCCD0 \uD655\uC7A5
  float bR=(0.022 + 0.23*smoothstep(0.34,1.0,g))*(0.20+0.80*front);   // v97 \uD37C\uC9C0\uB294 \uBC94\uC704 1/2
  // \uACBD\uACC4 \uD750\uD2B8\uB7EC\uB728\uB9AC\uAE30: \uC785\uC790\uBCC4 \uB3C4\uB2EC \uBC18\uACBD \uD3B8\uCC28 + \uAC01\uB3C4\uBCC4 \uC800\uC8FC\uD30C \uC694\uB3D9(\uC090\uC8FD\uC090\uC8FD) \u2192 \uC644\uC804\uD55C \uB3D9\uADF8\uB77C\uBBF8 \uBC29\uC9C0
  float rvar=0.58+0.84*fract(a_r1.x*17.7+a_r0.y*5.3);
  float lobe=1.0+0.17*sin(bang*3.0+u_t*0.6)+0.11*sin(bang*7.0-u_t*0.43)+0.07*sin(bang*13.0+u_t*0.9);
  float brad=bph*bph*bR*rvar*lobe;                                  // \uC911\uC2EC \uBC00\uC9D1(\uBC1C\uAD11\uD575) \u2192 \uBC14\uAE65 \uC2A4\uD2B8\uB9BC
  vec2 burst=u_touch + vec2(cos(bang),sin(bang))*brad;             // \uBC29\uC0AC \uBC1C\uC0B0 \uC88C\uD45C
  spos=mix(spos, burst, g);                                         // \uC785\uC790\uB2E8\uC704 \uC9C1\uC9C4 \uC7AC\uC815\uB82C(\uB514\uC878\uBE0C \uC544\uB2D8)
  float emit=smoothstep(0.0,0.05,bph)*(1.0-0.7*bph)*(1.0-0.55*smoothstep(0.55,1.0,bph*rvar)); // v96 \uAC00\uC7A5\uC790\uB9AC \uD398\uC774\uB4DC(\uACBD\uACC4 \uBD88\uBA85\uD655)
  float wglow=0.0;
  if(u_trailLive>0.5){                                              // v65 MUNG \uADA4\uC801 \uC640\uB958(\uD2B9\uC774\uC810 \uC81C\uAC70)
    for(int i=0;i<10;i++){
      vec4 tr=u_trail[i];
      vec2 dv=spos-tr.xy; float r2=dot(dv,dv); float r=sqrt(r2)+1e-4;
      float w=tr.w*exp(-tr.z*0.75)*exp(-r2*26.0)*smoothstep(0.012,0.09,r); // \uC911\uC2EC \uD2B9\uC774\uC810 \uC18C\uD504\uD2B8\uB2DD
      spos+=vec2(-dv.y,dv.x)/r*w*(0.045+0.03*sin(u_t*1.7+r*10.0-tr.z*2.5+a_r1.x*3.0));
      spos-=dv/r*w*0.018;
      wglow+=w;
    }
    float wk=step(0.88,fract(a_r0.w*43.1));                         // v65 12% \uB9AC\uBCF8 \uC785\uC790 \u2014 \uADA4\uC801 \uC704\uC5D0 \uB0A8\uC544 \uC694\uB3D9
    if(wk>0.5){
      float js=floor(fract(a_r1.x*7.3)*10.0);
      vec4 A=vec4(0.0);
      for(int i=0;i<10;i++){ if(float(i)==js) A=u_trail[i]; }
      float str=A.w*exp(-A.z*0.55)*smoothstep(0.05,0.14,length(A.xy-u_touch)); // \uC190\uB05D \uADFC\uCC98 \uC81C\uC678(\uCF54\uC5B4 \uBC31\uD654 \uBC29\uC9C0)
      if(str>0.02){
        vec2 rp=A.xy + vec2(a_r0.x-0.5,a_r0.y-0.5)*(0.045+A.z*0.10) // \uB098\uC774 \uB4E4\uC218\uB85D \uD655\uC0B0
              + vec2(sin(u_t*2.2+a_r1.x*9.0),cos(u_t*1.9+a_r0.x*7.0))*0.02; // \uC694\uB3D9
        spos=mix(spos, rp, min(1.0,str*1.6)*0.9);
        wglow+=str*0.7;                                             // \uC2A4\uD2B8\uB85C\uD06C \uC794\uAD11
      }
    }
  }
  float tp=g;                                                       // \uB2E4\uC6B4\uC2A4\uD2B8\uB9BC(\uBC1D\uAE30/\uD06C\uAE30)
  gl_Position=vec4(spos,0.0,1.0);
  float star=step(0.87,fract(a_r1.w*61.7));                         // v64 13% \uBCC4\xB787% \uBA3C\uC9C0(\uC54C\uC54C\uC774 \uC704\uACC4)
  v_star=star;
  gl_PointSize=u_ps*u_psMul*(0.6+a_r0.w)*(0.5+0.55*depth)*sc*(1.0-tp*0.22)*mix(0.72,1.5,star)*mix(1.0,0.6,halo);
  float twk=mix(1.0,0.78+0.22*sin(t*1.5+a_r0.w*44.0),u_twk*star);   // \uBC18\uC9DD\uC784\uC740 \uBCC4\uB9CC, \uB290\uB9AC\uAC8C
  float life=0.90+0.10*sin(t*1.1+a_r1.x*22.0);                      // \uC794\uC794\uD55C \uC0DD\uBA85 \uC228\uACB0
  float core=1.0+u_focal*0.22*smoothstep(0.6,0.0,rl);               // I: \uCF54\uC5B4 \uBC1C\uAD11(\uACFC\uD3EC\uD654 \uC5B5\uC81C)
  v_a*=(0.25+0.75*k)*u_lum*depth*twk*clamp(sc*0.66,0.34,1.34)*life*core
     *mix(${TUNE.starLo},${TUNE.starHi},star)*(0.90+0.10*u_breath)*(1.0+min(wglow,0.8)*0.9)
     *(1.0+wave*0.34*g)
     *mix(1.0, 0.42+1.25*emit, g)                                   // B: \uC911\uC2EC \uBC1D\uACE0 \uBC14\uAE65 \uAC10\uC1E0(\uBE5B \uBC1C\uC0B0)
     *(1.0-g*0.34*smoothstep(0.018,0.0,brad))                       // \uADF9\uC911\uC2EC \uD654\uC774\uD2B8\uC544\uC6C3\uB9CC \uC5B5\uC81C
     *(1.0-0.26*g*(1.0-g)*4.0);                                     // \uBE44\uD589 \uC911 \uAC10\uAD11(\uD50C\uB798\uC2DC \uBC29\uC9C0)
  v_pick=a_r1.z;
}`;
const GL_FRAG = `
precision mediump float;
uniform vec3 u_c1,u_c2,u_acc,u_wispCol; uniform float u_bright,u_alpha;
varying float v_a; varying float v_pick; varying float v_star;
void main(){
  float m=smoothstep(0.5,mix(0.33,0.07,v_star),length(gl_PointCoord-0.5));   // \uBA3C\uC9C0=\uB610\uB837\uD55C \uC54C, \uBCC4=\uBD80\uB4DC\uB7EC\uC6B4 \uD5E4\uC77C\uB85C
  vec3 col=v_pick<0.0?u_wispCol:(v_pick>0.76?u_acc:(v_pick>0.38?u_c2:u_c1));
  float a=m*v_a*u_alpha;
  gl_FragColor=vec4(col*a*u_bright,a);
}`;
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function glDetect() {
  try {
    if (typeof window === "undefined") return false;
    if (/[?&]r=2d(&|$)/.test(window.location.search)) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) {
    return false;
  }
}
function GuardianCanvasGL({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340, onFail }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let gl = null, raf = 0, dead = false, lostFn = null;
    const fail = () => {
      if (!dead) {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        onFail && onFail();
      }
    };
    try {
      gl = cv.getContext("webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true });
    } catch (_) {
    }
    if (!gl) {
      fail();
      return;
    }
    lostFn = (e) => {
      e.preventDefault();
      fail();
    };
    cv.addEventListener("webglcontextlost", lostFn);
    const touch = { x: 0, y: 0, amt: 0, target: 0, vx: 0, vy: 0, lx: 0, ly: 0, pressed: false };
    const setPos = (e) => {
      const r = cv.getBoundingClientRect();
      const cx = e.clientX, cy = e.clientY;
      if (cx == null) return;
      touch.x = (cx - r.left) / r.width * 2 - 1;
      touch.y = -((cy - r.top) / r.height * 2 - 1);
    };
    const onDown = (e) => {
      touch.pressed = true;
      touch.t0 = performance.now();
      setPos(e);
      touch.lx = touch.x;
      touch.ly = touch.y;
      touch.vx = 0;
      touch.vy = 0;
      touch.target = 1.15;
    };
    const onMove = (e) => {
      if (!touch.pressed) return;
      setPos(e);
      touch.target = 1.15;
    };
    const onUp = () => {
      touch.pressed = false;
      touch.target = 0;
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onUp);
    cv.addEventListener("pointercancel", onUp);
    try {
      const tx = mbti || texture(saju, zo, num);
      const E = tx[0] === "E", N = tx[1] === "N", T = tx[2] === "T", P = tx[3] === "P";
      const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.\uC77C || ""}`;
      const srnd = seedRnd(seedStr);
      const _b = birth || {};
      const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
      const tzSign = ((_nn + 19) % 20 + 20) % 20, tzTone = ((_nn + 3) % 13 + 13) % 13 + 1;
      const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));
      const nayF = 0.3 + nayinIdx % 10 * 0.07, nayA = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
      let nakIdx = 0, duEl = null;
      try {
        const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour);
        nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra));
      } catch (_) {
      }
      try {
        if (_b.sex) {
          const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", (/* @__PURE__ */ new Date()).getFullYear());
          if (_du && !_du.pre) duEl = _du.el;
        }
      } catch (_) {
      }
      const FORM_I = { \uD654: 0, \uC218: 1, \uBAA9: 2, \uAE08: 3, \uD1A0: 4 };
      const [b1, b2] = EL_COLOR[saju.main];
      const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
      const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
      const _ord = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      const subEl = _ord.find((e) => e !== saju.main) || saju.main;
      let c1 = hex2rgb(rotHue(b1, zoDeg)), c2 = hex2rgb(rotHue(b2, zoDeg));
      const acc = hex2rgb(rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5));
      if (duEl) {
        const dc = hex2rgb(EL_COLOR[duEl][0]);
        c2 = c2.map((v, i) => v * 0.78 + dc[i] * 0.22);
      }
      const lp = num || 5, arms = 3 + (lp - 1) % 5;
      const strands = 3 + tzSign % 6, twist = 1.2 + (tzTone - 1) * 0.22;
      const MOON_I = { \uC0C8\uB2EC: 0, \uCD08\uC2B9\uB2EC: 1, \uC0C1\uD604\uB2EC: 2, "\uCC28\uC624\uB974\uB294 \uB2EC": 3, \uBCF4\uB984\uB2EC: 4, "\uAE30\uC6B0\uB294 \uB2EC": 3, \uD558\uD604\uB2EC: 2, \uADF8\uBBD0\uB2EC: 1 };
      const lum = 0.72 + (MOON_I[moon?.name] ?? 2) * 0.1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(size * dpr);
      cv.height = Math.round(size * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      const n = E ? TUNE.nE : TUNE.nI;
      const r0 = new Float32Array(n * 4), r1 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        r0[i * 4] = srnd();
        r0[i * 4 + 1] = srnd();
        r0[i * 4 + 2] = srnd();
        r0[i * 4 + 3] = srnd();
        r1[i * 4] = srnd();
        r1[i * 4 + 1] = srnd();
        r1[i * 4 + 2] = srnd();
        r1[i * 4 + 3] = srnd();
      }
      const mk = (ty, s) => {
        const sh = gl.createShader(ty);
        gl.shaderSource(sh, s);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader");
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, GL_VERT));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, GL_FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      const buf = (name, arr) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
        return b;
      };
      buf("a_r0", r0);
      buf("a_r1", r1);
      const L = {};
      ["u_hold", "u_beat", "u_t", "u_form", "u_R", "u_arms", "u_strands", "u_twist", "u_speed", "u_chaos", "u_nayF", "u_nayA", "u_expand", "u_agi", "u_k", "u_ps", "u_lum", "u_twk", "u_psMul", "u_focal", "u_touch", "u_touchVel", "u_touchAmt", "u_breath", "u_trailLive", "u_zodiac", "u_c1", "u_c2", "u_acc", "u_wispCol", "u_bright", "u_alpha"].forEach((k) => {
        L[k] = gl.getUniformLocation(prog, k);
      });
      L.u_trail = gl.getUniformLocation(prog, "u_trail[0]");
      gl.uniform1f(L.u_form, FORM_I[saju.main] ?? 4);
      gl.uniform1f(L.u_R, 0.8 * (E ? 1 : 0.9));
      gl.uniform1f(L.u_arms, arms);
      gl.uniform1f(L.u_strands, strands);
      gl.uniform1f(L.u_twist, twist);
      gl.uniform1f(L.u_speed, P ? 0.42 : 0.3);
      gl.uniform1f(L.u_chaos, T ? 0.6 : 1.35);
      gl.uniform1f(L.u_focal, E ? 0.12 : 0.88);
      gl.uniform1f(L.u_nayF, nayF);
      gl.uniform1f(L.u_nayA, nayA);
      const F_AL = { \uD654: 0.36, \uC218: 0.31, \uBAA9: 0.32, \uAE08: 0.29, \uD1A0: 0.26 }[saju.main] || 0.31;
      const F_PS = { \uAE08: 0.82, \uD1A0: 0.9 }[saju.main] || 1;
      gl.uniform1f(L.u_ps, (T ? 1.6 : 2) * dpr * F_PS);
      gl.uniform1f(L.u_psMul, 1);
      gl.uniform1f(L.u_lum, lum);
      gl.uniform1f(L.u_twk, N ? 1 : 0);
      let _beat = 3;
      try {
        const mb = /[?&]beat=([\d.]+)/.exec(window.location.search);
        if (mb) _beat = Math.max(0, Math.min(3, parseFloat(mb[1])));
      } catch (_) {
      }
      gl.uniform1f(L.u_beat, _beat);
      let _soft = 1;
      try {
        const m = /[?&]soft=([\d.]+)/.exec(window.location.search);
        if (m) _soft = Math.max(0, Math.min(3, parseFloat(m[1])));
      } catch (_) {
      }
      gl.uniform3fv(L.u_c1, c1);
      gl.uniform3fv(L.u_c2, c2);
      gl.uniform3fv(L.u_acc, acc);
      gl.uniform2f(L.u_touch, 0, 0);
      gl.uniform2f(L.u_touchVel, 0, 0);
      gl.uniform1f(L.u_touchAmt, 0);
      gl.uniform1f(L.u_breath, 0);
      gl.uniform1f(L.u_trailLive, 0);
      gl.uniform1f(L.u_zodiac, saju.yJ ?? 0);
      gl.uniform3fv(L.u_wispCol, [0.5 + c1[0] * 0.28, 0.55 + c1[1] * 0.26, 0.66 + c1[2] * 0.2]);
      const trailArr = new Float32Array(40);
      let trailHead = 0, lastDrop = 0;
      gl.uniform4fv(L.u_trail, trailArr);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      const born = performance.now();
      let lastHeavy = 0;
      const draw = () => {
        if (dead) return;
        const now = performance.now();
        const agi = agitateRef && agitateRef.current ? 1 : 0;
        let expand = 0, bright = 1, reacting = false;
        if (reactRef && reactRef.current) {
          const rt = (now - reactRef.current.t0) / 1e3;
          if (rt < 1.8) {
            reacting = true;
            const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18);
            const dir = reactRef.current.dir;
            if (dir === "GO") {
              expand = env * 0.5;
              bright = 1 + env * 0.5;
            } else if (dir === "STOP") {
              expand = -env * 0.45;
              bright = 1 - env * 0.55;
            } else {
              expand = env * 0.1 * Math.sin(rt * 5);
              bright = 1 - env * 0.12;
            }
          }
        }
        const restMs = restRef && restRef.current ? restRef.current : 0;
        if (restMs && !agi && !reacting && touch.amt < 0.02 && now - lastHeavy < restMs) {
          raf = requestAnimationFrame(draw);
          return;
        }
        lastHeavy = now;
        const t = (now - born) / 1e3;
        const dt = Math.min(0.05, Math.max(1e-3, t - (draw._lt ?? t - 0.016)));
        draw._lt = t;
        gl.uniform1f(L.u_k, Math.min(1, t / 3.4));
        gl.uniform1f(L.u_agi, agi);
        gl.uniform1f(L.u_expand, expand);
        gl.uniform1f(L.u_bright, bright);
        const bph = now * Math.PI * 2 / 9e3;
        gl.uniform1f(L.u_breath, Math.sin(bph - 0.35 * Math.sin(bph)));
        const tau = touch.target > touch.amt ? 0.55 : 1.6;
        touch.amt += (touch.target - touch.amt) * (1 - Math.exp(-dt / tau));
        const dvx = touch.x - touch.lx, dvy = touch.y - touch.ly;
        touch.lx = touch.x;
        touch.ly = touch.y;
        const kv = 1 - Math.exp(-dt / 0.06);
        touch.vx += (dvx - touch.vx) * kv;
        touch.vy += (dvy - touch.vy) * kv;
        let live = 0;
        for (let i = 0; i < 10; i++) {
          trailArr[i * 4 + 2] += dt;
          if (trailArr[i * 4 + 3] * Math.exp(-trailArr[i * 4 + 2] * 0.75) > 0.02) live = 1;
        }
        if (touch.pressed && now - lastDrop > 45) {
          trailArr.set([touch.x, touch.y, 0, Math.min(1, Math.hypot(touch.vx, touch.vy) * 22 + 0.15)], trailHead * 4);
          trailHead = (trailHead + 1) % 10;
          lastDrop = now;
          live = 1;
        }
        gl.uniform4fv(L.u_trail, trailArr);
        gl.uniform1f(L.u_trailLive, live);
        gl.uniform2f(L.u_touch, touch.x, touch.y);
        gl.uniform1f(L.u_touchAmt, touch.amt);
        gl.uniform2f(L.u_touchVel, touch.vx, touch.vy);
        const _hold = touch.pressed ? Math.min(2.4, (now - (touch.t0 || now)) / 1e3) : 0;
        gl.uniform1f(L.u_hold, _hold);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(L.u_t, t);
        gl.uniform1f(L.u_psMul, 3.6);
        gl.uniform1f(L.u_alpha, 0.05 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        if (_soft > 0) {
          gl.uniform1f(L.u_psMul, 1.8);
          gl.uniform1f(L.u_alpha, 0.22 * _soft * F_AL);
          gl.drawArrays(gl.POINTS, 0, n);
        }
        gl.uniform1f(L.u_psMul, 1);
        gl.uniform1f(L.u_alpha, 0.72 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.uniform1f(L.u_t, t - 0.22);
        gl.uniform1f(L.u_alpha, 0.3 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.uniform1f(L.u_t, t - 0.5);
        gl.uniform1f(L.u_alpha, 0.13 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        raf = requestAnimationFrame(draw);
      };
      draw();
    } catch (_) {
      fail();
      return;
    }
    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (lostFn) cv.removeEventListener("webglcontextlost", lostFn);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onUp);
      cv.removeEventListener("pointercancel", onUp);
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext && ext.loseContext();
      } catch (_) {
      }
    };
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return /* @__PURE__ */ jsx("canvas", { ref, "data-renderer": "webgl", width: size, height: size, style: { display: "block", width: size + "px", height: size + "px", touchAction: "none", cursor: "pointer", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)", maskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)" } });
}
const SHAPE_UNI = `uniform float u_t,u_speed,u_form,u_R,u_arms,u_strands,u_twist,u_chaos,u_nayF,u_nayA,u_expand,u_agi,u_focal,u_breath,u_touchAmt; uniform vec2 u_touch;`;
const SHAPE_FN = `
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
vec2 curl2(vec2 p){ float e=0.12; float x1=vnoise(p+vec2(0.0,e)),x2=vnoise(p-vec2(0.0,e)),y1=vnoise(p+vec2(e,0.0)),y2=vnoise(p-vec2(e,0.0)); return vec2(x1-x2,-(y1-y2))/(2.0*e); }
void computeShape(vec4 a_r0, vec4 a_r1, out vec2 spos, out float depth, out float v_a, out float sc, out float rl){
  float t=u_t*u_speed;
  float strand=floor(a_r1.w*u_strands+0.0001);
  float sOff=strand/max(u_strands,1.0);
  vec2 p; depth=1.0; v_a=1.0;
  if(u_form<0.5){
    float sh=fract(sin(strand*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*(0.032+0.022*sh)*(0.5+a_r0.z));
    float y=mix(-1.05,1.05,s);
    float tw=s*u_twist*6.2832+t*(0.18+0.12*sh)+sOff*6.2832+sh*3.1;
    float rad=(0.13+0.1*sin(s*5.0+t*0.45+a_r1.x))*(0.5+0.9*a_r0.x)*(0.7+0.6*sh);
    p=vec2(sin(tw)*rad*2.1+0.16*sin(y*1.6+t*0.14+sh*6.2)+sin(s*3.0+t*0.2+sOff*9.0)*0.12*u_chaos, y);
    depth=0.45+0.55*(0.5+0.5*cos(tw)); v_a=0.5+0.5*s;
  } else if(u_form<1.5){
    float dir=mod(strand,2.0)<0.5?1.0:-1.0;
    float x=mix(-1.25,1.25,fract(a_r0.x+t*0.03*dir*(0.6+a_r0.z)));
    float band=(sOff-0.5)*1.5;
    p=vec2(x, band+0.11*sin(x*3.6+t*0.55+a_r1.x)+(a_r0.y-0.5)*0.16);
    depth=0.5+0.5*a_r0.z; v_a=(1.0-abs(x)*0.45)*0.9;
  } else if(u_form<2.5){
    float br=mod(strand,u_arms);
    float ang=1.5708+(br-(u_arms-1.0)*0.5)*0.42+0.05*sin(t*0.35+br*2.0);
    float s=fract(a_r0.y+t*0.035*(0.5+a_r0.z));
    vec2 d=vec2(cos(ang),sin(ang));
    p=vec2((a_r0.x-0.5)*0.62,-0.8)+d*(s*1.8)+vec2(-d.y,d.x)*(a_r0.x-0.5)*(0.12+s*0.55)+vec2(sin(s*8.0+t*0.5+a_r1.x),cos(s*7.0-t*0.5))*0.05*s*u_chaos;
    depth=0.5+0.5*(1.0-s); v_a=(0.4+0.6*(1.0-s*0.55))*(0.4+0.6*smoothstep(0.0,0.2,s));
  } else if(u_form<3.5){
    float str=strand; float sh=fract(sin(str*12.9898)*43758.5453);
    float s=fract(a_r0.y+t*0.05*(0.7+0.5*sh));
    float y=mix(1.0,-1.0,s);
    float lane=(str/max(u_strands,1.0)-0.5)*1.1;
    float coil=sin(y*3.0+str*2.4+t*0.5)*(0.13+0.09*u_twist)*(0.4+0.6*s);
    float x=lane*(1.0-0.35*s)+coil+(a_r0.x-0.5)*0.14;
    p=vec2(x,y); depth=0.5+0.5*sh;
    float glint=step(0.93,a_r1.x)*0.7;
    v_a=((0.5+0.5*(1.0-abs(x)*0.5))+glint)*smoothstep(0.0,0.07,s)*smoothstep(1.0,0.9,s);
  } else {
    float rr=pow(a_r0.z,0.75)*0.88;
    float ang=a_r0.x*6.2832+t*0.05;
    p=vec2(cos(ang),sin(ang)*0.92)*rr;
    p+=u_chaos*0.16*vec2(sin(p.y*2.1+t*0.2+a_r1.x),cos(p.x*1.9-t*0.18+a_r0.y*6.0));
    p+=u_chaos*0.06*vec2(sin(p.y*5.3-t*0.3+a_r0.w*9.0),cos(p.x*4.7+t*0.26+a_r1.x*3.0));
    p*=1.0+0.03*sin(t*0.4); depth=0.5+0.5*a_r0.y; v_a=0.55+0.45*(1.0-rr*0.7);
  }
  float halo=step(0.84,a_r1.y);
  if(halo>0.5){
    float hr=0.55+1.05*pow(a_r0.z,0.6);
    float ha=a_r0.x*6.2832 + t*(0.05/(0.3+hr));
    p=vec2(cos(ha),sin(ha)*0.62)*hr; depth=0.35+0.3*a_r0.y; v_a=0.10+0.10*a_r0.w;
  }
  vec2 fdir = u_form<0.5 ? vec2(0.0,1.0) : u_form<1.5 ? vec2(1.0,0.1) : u_form<2.5 ? vec2(0.15,1.0) : u_form<3.5 ? vec2(0.0,-1.0) : vec2(0.0,0.55);
  vec2 cflow = curl2(p*1.8 + fdir*(t*0.14) + vec2(0.0, t*0.08));
  p += (0.034+0.026*u_chaos) * cflow;
  p += fdir * 0.02 * (0.55+0.45*sin(t*0.3+a_r0.w*6.283));
  p*=mix(1.14,0.9,u_focal);
  p+=(1.0-u_focal)*0.2*smoothstep(0.0,3.5,u_t)*vec2(sin(t*0.24+1.7),sin(t*0.19+0.3));
  rl=length(p);
  p+=u_nayA*0.055*vec2(sin(t*u_nayF+a_r0.w*6.2832),cos(t*u_nayF*1.1+a_r1.x));
  p+=u_agi*0.05*vec2(sin(t*9.0+a_r0.w*40.0),cos(t*8.0+a_r1.x*40.0));
  p*=(1.0+u_expand)*(1.0+0.075*u_breath)*u_R;
  float zc=(a_r0.w-0.5)*0.6+(depth-0.5)*0.3;
  vec3 P=vec3(p,zc);
  float dwr=t*(0.07/(0.35+rl));
  float cwr=cos(dwr), swr=sin(dwr);
  P.xz=mat2(cwr,-swr,swr,cwr)*P.xz;
  if(u_form>3.5){ float d2=dwr*0.6; P.xy=mat2(cos(d2),-sin(d2),sin(d2),cos(d2))*P.xy; }
  float ax = u_form<0.5 ? 0.42 : u_form<1.5 ? 0.9 : u_form<2.5 ? 0.46 : u_form<3.5 ? 0.4 : 0.74;
  P.yz=mat2(cos(ax),-sin(ax),sin(ax),cos(ax))*P.yz;
  float ay=0.06*sin(t*0.5);
  P.xz=mat2(cos(ay),-sin(ay),sin(ay),cos(ay))*P.xz;
  float dcam=2.4; sc=dcam/(dcam+P.z);
  spos=P.xy*sc*0.48;
  float ta=clamp(u_touchAmt,0.0,1.0);
  spos+=vec2(sin(t*0.11+1.3)*0.11, sin(t*0.17)*0.07+0.012*u_breath)*(1.0-ta)*smoothstep(0.0,3.5,u_t);
}`;
const SIM_VERT = `attribute vec2 a_q; void main(){ gl_Position=vec4(a_q,0.0,1.0); }`;
const SIM_FRAG = `precision highp float;
` + SHAPE_UNI + `
uniform sampler2D u_state,u_r0,u_r1; uniform vec2 u_texdim,u_touchVel; uniform float u_dt,u_bloom; uniform vec4 u_trail[12];
` + SHAPE_FN + `
void main(){
  vec2 uv=gl_FragCoord.xy/u_texdim;
  vec4 st=texture2D(u_state,uv); vec4 a_r0=texture2D(u_r0,uv); vec4 a_r1=texture2D(u_r1,uv);
  vec2 pos=st.xy, vel=st.zw;
  vec2 spos; float depth,v_a,sc,rl;
  computeShape(a_r0,a_r1,spos,depth,v_a,sc,rl);
  vec2 target=spos;
  float ta=clamp(u_touchAmt,0.0,1.0);
  float stg=a_r1.z*${TUNE.stg}; float g=clamp((ta-stg)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);
  if(g>0.001){
    float bang=a_r1.w*6.2832;
    float bR=0.014+0.07*u_bloom;                                // v72 \uBC29\uC0AC \uB354 \uC881\uAC8C
    float rr=0.3+0.7*a_r0.z;
    vec2 burst=u_touch+vec2(cos(bang),sin(bang))*(rr*bR);
    target=mix(target,burst,g);
  }
  float spd=min(length(u_touchVel),0.06);
  float k=mix(14.0,10.0,g)-spd*120.0; k=max(k,2.0);           // \uB300\uAE30 \uAC15\uC131\u2191(\uD06C\uB9AC\uC2A4\uD504), \uB4DC\uB798\uADF8 \uC2DC \uB290\uC2A8(\uC794\uC0C1)
  float damp=mix(9.0,5.5,g)-spd*55.0; damp=max(damp,2.5);
  vec2 acc=(target-pos)*k - vel*damp;
  if(g>0.15){
    vec2 d=pos-u_touch; float dl=length(d)+1e-4; vec2 dn=d/dl; vec2 cw=vec2(dn.y,-dn.x); // \uC2DC\uACC4\uBC29\uD5A5 \uC811\uC120
    acc += cw*g*2.2*exp(-dl*dl*90.0)*u_bloom;                  // v73 \uBC29\uC0AC/\uD06C\uB798\uD074\uC740 \uB2E4 \uBAA8\uC778 \uB4A4(bloom)\uC5D0\uB9CC \uC2DC\uC791
    for(int i=0;i<12;i++){                                     // v72 \uADA4\uC801(\uC871\uC801) \uB530\uB77C \uBD88\uAF43 \uD290
      vec4 tr=u_trail[i];
      float fresh=tr.w*exp(-tr.z*1.3)*step(0.02,tr.w);         // \uC871\uC801 \uC2E0\uC120\uB3C4(\uC624\uB798\uB418\uBA74 \uC0AC\uADF8\uB77C\uB4E6)
      vec2 tv=pos-tr.xy; float tr2=dot(tv,tv); float trl=sqrt(tr2)+1e-4;
      float nearT=exp(-tr2*70.0);
      acc += -tv*nearT*fresh*7.0;                              // \uC871\uC801\uC73C\uB85C \uBAA8\uC784(\uADA4\uC801 \uC5F0\uACB0\uC131) \u2014 \uD56D\uC0C1
      float crackle=step(0.72,fract(a_r0.w*23.1+floor(u_t*16.0)*0.41+float(i)*0.17+a_r1.x*2.0));
      acc += (tv/trl+cw*0.4)*nearT*fresh*crackle*34.0*u_bloom; // \uC871\uC801 \uBD88\uAF43 \uD290 \u2014 \uB3C4\uCC29(bloom) \uD6C4
    }
  }
  vel+=acc*u_dt;
  float vm=length(vel); if(vm>8.5) vel*=8.5/vm;                // \uD3ED\uC8FC \uBC29\uC9C0
  pos+=vel*u_dt;
  gl_FragColor=vec4(pos,vel);
}`;
const RND_VERT = SHAPE_UNI + `
uniform sampler2D u_state; uniform vec2 u_texdim; uniform float u_ps,u_psMul,u_lum,u_twk,u_k,u_bloom;
attribute vec4 a_r0,a_r1; attribute float a_idx;
varying float v_a,v_pick,v_star;
` + SHAPE_FN + `
void main(){
  vec2 spos; float depth,va0,sc,rl;
  computeShape(a_r0,a_r1,spos,depth,va0,sc,rl);
  vec2 uv=(vec2(mod(a_idx,u_texdim.x),floor(a_idx/u_texdim.x))+0.5)/u_texdim;
  vec2 pos=texture2D(u_state,uv).xy;
  gl_Position=vec4(pos,0.0,1.0);
  float t=u_t*u_speed;
  float halo=step(0.84,a_r1.y);
  float star=step(0.87,fract(a_r1.w*61.7)); v_star=star;
  float ta=clamp(u_touchAmt,0.0,1.0);
  float stg=a_r1.z*${TUNE.stg}; float g=clamp((ta-stg)/0.28,0.0,1.0); g=g*g*(3.0-2.0*g);
  gl_PointSize=u_ps*u_psMul*(0.6+a_r0.w)*(0.5+0.55*depth)*sc*mix(0.72,1.5,star)*mix(1.0,0.6,halo);
  float twk=mix(1.0,0.78+0.22*sin(t*1.5+a_r0.w*44.0),u_twk*star);
  float life=0.90+0.10*sin(t*1.1+a_r1.x*22.0);
  float core=1.0+u_focal*0.22*smoothstep(0.6,0.0,rl);
  float rr=length(pos-u_touch);
  float er=clamp(rr/0.18,0.0,1.0);
  float emitB=mix(1.0,0.6+1.0*(1.0-er)*(1.0-er),g);                  // B: \uC791\uC740 \uCF54\uC5B4 \uBC1D\uACE0 \uC2A4\uD30C\uD06C\uB85C \uAC08\uC218\uB85D \uAC10\uC1E0
  float kA=clamp(u_k,0.0,1.0);                                       // 'asm'\uC740 GLSL \uC608\uC57D\uC5B4 \u2014 \uC5C4\uACA9 \uB4DC\uB77C\uC774\uBC84\uC11C sim \uD3F4\uBC31\uB418\uBBC0\uB85C \uAC1C\uBA85 \uC720\uC9C0
  v_a=va0*(0.25+0.75*kA)*u_lum*depth*twk*clamp(sc*0.66,0.34,1.34)*life*core*mix(${TUNE.starLo},${TUNE.starHi},star)*(0.90+0.10*u_breath)*emitB;
  v_pick=a_r1.z;
}`;
const RND_FRAG = `precision mediump float;
uniform vec3 u_c1,u_c2,u_acc; uniform float u_bright,u_alpha;
varying float v_a,v_pick,v_star;
void main(){
  float m=smoothstep(0.5,mix(0.33,0.07,v_star),length(gl_PointCoord-0.5));
  vec3 col=v_pick>0.76?u_acc:(v_pick>0.38?u_c2:u_c1);
  float a=m*v_a*u_alpha;
  gl_FragColor=vec4(col*a*u_bright,a);
}`;
function GuardianCanvasSim({ saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size = 340, onFail }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let gl = null, raf = 0, dead = false, lostFn = null;
    const fail = () => {
      if (!dead) {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        onFail && onFail();
      }
    };
    try {
      gl = cv.getContext("webgl", { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true });
    } catch (_) {
    }
    if (!gl) {
      fail();
      return;
    }
    const extF = gl.getExtension("OES_texture_float");
    if (!extF || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) {
      fail();
      return;
    }
    gl.getExtension("OES_texture_float_linear");
    gl.getExtension("WEBGL_color_buffer_float");
    lostFn = (e) => {
      e.preventDefault();
      fail();
    };
    cv.addEventListener("webglcontextlost", lostFn);
    const touch = { x: 0, y: 0, amt: 0, target: 0, vx: 0, vy: 0, lx: 0, ly: 0, pressed: false };
    const setPos = (e) => {
      const r = cv.getBoundingClientRect();
      const cx = e.clientX, cy = e.clientY;
      if (cx == null) return;
      touch.x = (cx - r.left) / r.width * 2 - 1;
      touch.y = -((cy - r.top) / r.height * 2 - 1);
    };
    const onDown = (e) => {
      touch.pressed = true;
      setPos(e);
      touch.lx = touch.x;
      touch.ly = touch.y;
      touch.vx = 0;
      touch.vy = 0;
      touch.target = 1.15;
    };
    const onMove = (e) => {
      if (!touch.pressed) return;
      setPos(e);
      touch.target = 1.15;
    };
    const onUp = () => {
      touch.pressed = false;
      touch.target = 0;
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onUp);
    cv.addEventListener("pointercancel", onUp);
    try {
      const tx = mbti || texture(saju, zo, num);
      const E = tx[0] === "E", N = tx[1] === "N", T = tx[2] === "T", P = tx[3] === "P";
      const seedStr = `${saju.main}${zo?.name || ""}${mbti || ""}${num || ""}${saju.pillars?.\uC77C || ""}`;
      const srnd = seedRnd(seedStr);
      const _b = birth || {};
      const _jd = _b.y ? jdn(+_b.y, +_b.m, +_b.d) : 0, _nn = _jd - 584283;
      const tzSign = ((_nn + 19) % 20 + 20) % 20, tzTone = ((_nn + 3) % 13 + 13) % 13 + 1;
      const nayinIdx = Math.max(0, NAYIN.indexOf(saju.nayin));
      const nayF = 0.3 + nayinIdx % 10 * 0.07, nayA = 0.32 + Math.floor(nayinIdx / 10) * 0.26;
      let nakIdx = 0, duEl = null;
      try {
        const _mp = moonPlacements(+_b.y, +_b.m, +_b.d, +_b.h || 12, +_b.min || 0, !!_b.noHour);
        nakIdx = Math.max(0, NAKSHATRA.indexOf(_mp.nakshatra));
      } catch (_) {
      }
      try {
        if (_b.sex) {
          const _du = daeun(+_b.y, +_b.m, +_b.d, _b.noHour ? 12 : +_b.h, _b.noHour || _b.min === "" ? 0 : +_b.min, !!_b.noHour, cityLon(_b.city), _b.sex === "M", (/* @__PURE__ */ new Date()).getFullYear());
          if (_du && !_du.pre) duEl = _du.el;
        }
      } catch (_) {
      }
      const FORM_I = { \uD654: 0, \uC218: 1, \uBAA9: 2, \uAE08: 3, \uD1A0: 4 };
      const [b1, b2] = EL_COLOR[saju.main];
      const zoIdx = Math.max(0, ZO_ORDER.indexOf(zo?.name));
      const zoDeg = (zoIdx - 5.5) * 6 + (srnd() - 0.5) * 16;
      const _ord = Object.entries(saju.counts || {}).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      const subEl = _ord.find((e) => e !== saju.main) || saju.main;
      let c1 = hex2rgb(rotHue(b1, zoDeg)), c2 = hex2rgb(rotHue(b2, zoDeg));
      const acc = hex2rgb(rotHue(EL_COLOR[subEl][1], zoDeg * 0.5 + nakIdx * 5));
      if (duEl) {
        const dc = hex2rgb(EL_COLOR[duEl][0]);
        c2 = c2.map((v, i) => v * 0.78 + dc[i] * 0.22);
      }
      const lp = num || 5, arms = 3 + (lp - 1) % 5;
      const strands = 3 + tzSign % 6, twist = 1.2 + (tzTone - 1) * 0.22;
      const MOON_I = { \uC0C8\uB2EC: 0, \uCD08\uC2B9\uB2EC: 1, \uC0C1\uD604\uB2EC: 2, "\uCC28\uC624\uB974\uB294 \uB2EC": 3, \uBCF4\uB984\uB2EC: 4, "\uAE30\uC6B0\uB294 \uB2EC": 3, \uD558\uD604\uB2EC: 2, \uADF8\uBBD0\uB2EC: 1 };
      const lum = 0.72 + (MOON_I[moon?.name] ?? 2) * 0.1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(size * dpr);
      cv.height = Math.round(size * dpr);
      const n = E ? TUNE.nE : TUNE.nI;
      const W = 256, H = Math.ceil(n / W), TN = W * H;
      const r0 = new Float32Array(TN * 4), r1 = new Float32Array(TN * 4), stInit = new Float32Array(TN * 4), idxArr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = srnd(), b = srnd(), c = srnd(), d = srnd(), e = srnd(), f = srnd(), gg = srnd(), h = srnd();
        r0[i * 4] = a;
        r0[i * 4 + 1] = b;
        r0[i * 4 + 2] = c;
        r0[i * 4 + 3] = d;
        r1[i * 4] = e;
        r1[i * 4 + 1] = f;
        r1[i * 4 + 2] = gg;
        r1[i * 4 + 3] = h;
        const ang = e * 6.2832, rr = 1.15 + c * 0.75;
        stInit[i * 4] = Math.cos(ang) * rr;
        stInit[i * 4 + 1] = Math.sin(ang) * rr;
        stInit[i * 4 + 2] = 0;
        stInit[i * 4 + 3] = 0;
        idxArr[i] = i;
      }
      const mkTex = (data) => {
        const tx2 = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx2);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.FLOAT, data);
        return tx2;
      };
      const mkSh = (ty, s) => {
        const sh = gl.createShader(ty);
        gl.shaderSource(sh, s);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "sh");
        return sh;
      };
      const mkProg = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, mkSh(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, mkSh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || "link");
        return pr;
      };
      const simP = mkProg(SIM_VERT, SIM_FRAG), rndP = mkProg(RND_VERT, RND_FRAG);
      const r0Tex = mkTex(r0), r1Tex = mkTex(r1);
      let stateTex = [mkTex(stInit), mkTex(new Float32Array(TN * 4))];
      const fbo = stateTex.map((tx2) => {
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx2, 0);
        return f;
      });
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        fail();
        return;
      }
      const quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const mkBuf = (arr) => {
        const bb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bb);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        return bb;
      };
      const r0Buf = mkBuf(r0.subarray(0, n * 4)), r1Buf = mkBuf(r1.subarray(0, n * 4)), idxBuf = mkBuf(idxArr);
      const uni = (pr, names) => {
        const m = {};
        names.forEach((k) => m[k] = gl.getUniformLocation(pr, k));
        return m;
      };
      const SHU = ["u_t", "u_speed", "u_form", "u_R", "u_arms", "u_strands", "u_twist", "u_chaos", "u_nayF", "u_nayA", "u_expand", "u_agi", "u_focal", "u_breath", "u_touchAmt", "u_touch"];
      const simU = uni(simP, [...SHU, "u_state", "u_r0", "u_r1", "u_texdim", "u_touchVel", "u_dt", "u_bloom"]);
      simU.u_trail = gl.getUniformLocation(simP, "u_trail[0]");
      const rndU = uni(rndP, [...SHU, "u_state", "u_texdim", "u_ps", "u_psMul", "u_lum", "u_twk", "u_k", "u_bloom", "u_c1", "u_c2", "u_acc", "u_bright", "u_alpha"]);
      const simA = { a_q: gl.getAttribLocation(simP, "a_q") };
      const rndA = { a_r0: gl.getAttribLocation(rndP, "a_r0"), a_r1: gl.getAttribLocation(rndP, "a_r1"), a_idx: gl.getAttribLocation(rndP, "a_idx") };
      const F_AL = { \uD654: 0.36, \uC218: 0.31, \uBAA9: 0.32, \uAE08: 0.29, \uD1A0: 0.26 }[saju.main] || 0.31;
      const F_PS = { \uAE08: 0.82, \uD1A0: 0.9 }[saju.main] || 1;
      const cfg = { form: FORM_I[saju.main] ?? 4, R: 0.8 * (E ? 1 : 0.9), arms, strands, twist, speed: P ? 0.42 : 0.3, chaos: T ? 0.6 : 1.35, focal: E ? 0.12 : 0.88, nayF, nayA, ps: (T ? 1.6 : 2) * dpr * F_PS, lum, twk: N ? 1 : 0 };
      const setStatic = (pr, U, isRnd) => {
        gl.useProgram(pr);
        gl.uniform1f(U.u_form, cfg.form);
        gl.uniform1f(U.u_R, cfg.R);
        gl.uniform1f(U.u_arms, cfg.arms);
        gl.uniform1f(U.u_strands, cfg.strands);
        gl.uniform1f(U.u_twist, cfg.twist);
        gl.uniform1f(U.u_speed, cfg.speed);
        gl.uniform1f(U.u_chaos, cfg.chaos);
        gl.uniform1f(U.u_focal, cfg.focal);
        gl.uniform1f(U.u_nayF, cfg.nayF);
        gl.uniform1f(U.u_nayA, cfg.nayA);
        gl.uniform2f(U.u_texdim, W, H);
        if (isRnd) {
          gl.uniform1f(U.u_ps, cfg.ps);
          gl.uniform1f(U.u_lum, cfg.lum);
          gl.uniform1f(U.u_twk, cfg.twk);
          gl.uniform3fv(U.u_c1, c1);
          gl.uniform3fv(U.u_c2, c2);
          gl.uniform3fv(U.u_acc, acc);
        }
      };
      setStatic(simP, simU, false);
      setStatic(rndP, rndU, true);
      const setDyn = (U, t, expand, agi, breath, bright) => {
        gl.uniform1f(U.u_t, t);
        gl.uniform1f(U.u_expand, expand);
        gl.uniform1f(U.u_agi, agi);
        gl.uniform1f(U.u_breath, breath);
        gl.uniform1f(U.u_touchAmt, touch.amt);
        gl.uniform2f(U.u_touch, touch.x, touch.y);
      };
      let src = 0, dst = 1, bloom = 0;
      const trailArr = new Float32Array(48);
      let trailHead = 0, lastDrop = 0;
      const born = performance.now();
      const draw = () => {
        if (dead) return;
        const now = performance.now();
        const t = (now - born) / 1e3;
        const dt = Math.min(0.033, Math.max(1e-3, t - (draw._lt ?? t - 0.016)));
        draw._lt = t;
        const agi = agitateRef && agitateRef.current ? 1 : 0;
        let expand = 0, bright = 1;
        if (reactRef && reactRef.current) {
          const rt = (now - reactRef.current.t0) / 1e3;
          if (rt < 1.8) {
            const env = Math.max(0, 1 - rt / 1.7) * Math.min(1, rt / 0.18);
            const dir = reactRef.current.dir;
            if (dir === "GO") {
              expand = env * 0.5;
              bright = 1 + env * 0.5;
            } else if (dir === "STOP") {
              expand = -env * 0.45;
              bright = 1 - env * 0.55;
            } else {
              expand = env * 0.1 * Math.sin(rt * 5);
              bright = 1 - env * 0.12;
            }
          }
        }
        const tau = touch.target > touch.amt ? 0.55 : 1.6;
        touch.amt += (touch.target - touch.amt) * (1 - Math.exp(-dt / tau));
        const bloomT = touch.amt > 0.88 ? 1 : 0;
        bloom += (bloomT - bloom) * (1 - Math.exp(-dt / (bloomT > bloom ? 0.9 : 0.45)));
        const dvx = touch.x - touch.lx, dvy = touch.y - touch.ly;
        touch.lx = touch.x;
        touch.ly = touch.y;
        const kv = 1 - Math.exp(-dt / 0.06);
        touch.vx += (dvx - touch.vx) * kv;
        touch.vy += (dvy - touch.vy) * kv;
        const bph = now * Math.PI * 2 / 9e3;
        const breath = Math.sin(bph - 0.35 * Math.sin(bph));
        const uk = Math.min(1, t / 3.4);
        for (let i = 0; i < 12; i++) trailArr[i * 4 + 2] += dt;
        const _li = (trailHead + 11) % 12 * 4;
        const _moved = Math.hypot(touch.x - trailArr[_li], touch.y - trailArr[_li + 1]);
        if (touch.pressed && (now - lastDrop > 14 || _moved > 0.045)) {
          trailArr[trailHead * 4] = touch.x;
          trailArr[trailHead * 4 + 1] = touch.y;
          trailArr[trailHead * 4 + 2] = 0;
          trailArr[trailHead * 4 + 3] = 1;
          trailHead = (trailHead + 1) % 12;
          lastDrop = now;
        }
        gl.useProgram(simP);
        gl.disable(gl.BLEND);
        gl.viewport(0, 0, W, H);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.enableVertexAttribArray(simA.a_q);
        gl.vertexAttribPointer(simA.a_q, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, r0Tex);
        gl.uniform1i(simU.u_r0, 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, r1Tex);
        gl.uniform1i(simU.u_r1, 2);
        gl.uniform2f(simU.u_touchVel, touch.vx, touch.vy);
        gl.uniform1f(simU.u_bloom, bloom);
        gl.uniform4fv(simU.u_trail, trailArr);
        const sub = 2, sdt = dt / sub;
        for (let s = 0; s < sub; s++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[dst]);
          gl.viewport(0, 0, W, H);
          setDyn(simU, t, expand, agi, breath, bright);
          gl.uniform1f(simU.u_dt, sdt);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, stateTex[src]);
          gl.uniform1i(simU.u_state, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          const tmp = src;
          src = dst;
          dst = tmp;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cv.width, cv.height);
        gl.useProgram(rndP);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, r0Buf);
        gl.enableVertexAttribArray(rndA.a_r0);
        gl.vertexAttribPointer(rndA.a_r0, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, r1Buf);
        gl.enableVertexAttribArray(rndA.a_r1);
        gl.vertexAttribPointer(rndA.a_r1, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf);
        gl.enableVertexAttribArray(rndA.a_idx);
        gl.vertexAttribPointer(rndA.a_idx, 1, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, stateTex[src]);
        gl.uniform1i(rndU.u_state, 0);
        setDyn(rndU, t, expand, agi, breath, bright);
        gl.uniform1f(rndU.u_k, uk);
        gl.uniform1f(rndU.u_bloom, bloom);
        gl.uniform1f(rndU.u_bright, bright);
        gl.uniform1f(rndU.u_psMul, 3.6);
        gl.uniform1f(rndU.u_alpha, 0.05 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.uniform1f(rndU.u_psMul, 1.8);
        gl.uniform1f(rndU.u_alpha, 0.22 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.uniform1f(rndU.u_psMul, 1);
        gl.uniform1f(rndU.u_alpha, 0.85 * F_AL);
        gl.drawArrays(gl.POINTS, 0, n);
        raf = requestAnimationFrame(draw);
      };
      draw();
    } catch (_) {
      fail();
      return;
    }
    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (lostFn) cv.removeEventListener("webglcontextlost", lostFn);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onUp);
      cv.removeEventListener("pointercancel", onUp);
      try {
        const ext = gl.getExtension("WEBGL_lose_context");
        ext && ext.loseContext();
      } catch (_) {
      }
    };
  }, [saju, zo, mbti, size, birth && birth.y, birth && birth.sex, birth && birth.name]);
  return /* @__PURE__ */ jsx("canvas", { ref, "data-renderer": "webgl", width: size, height: size, style: { display: "block", width: size + "px", height: size + "px", touchAction: "none", cursor: "pointer", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)", maskImage: "radial-gradient(circle at 50% 50%, #000 74%, transparent 100%)" } });
}
const SEAL_REST = { current: 320 };
function GuardianSeal({ saju, zo, mbti, num, moon, birth, kind }) {
  if (!saju || !zo) return null;
  const el = EL_COLOR[saju.main] || ["#f5d98b", "#ffe9ad"];
  const nay = saju.nayin ? saju.nayin.split("\xB7")[1] || saju.nayin : null;
  const who = (birth?.name || "").trim();
  return /* @__PURE__ */ jsxs("div", { className: "gsealwrap", children: [
    /* @__PURE__ */ jsx("div", { className: "gsealorb", style: { borderColor: el[0] + "4d", boxShadow: `0 0 30px ${el[0]}2b` }, children: /* @__PURE__ */ jsx("div", { className: "gsealinner", children: /* @__PURE__ */ jsx(Guardian, { saju, zo, mbti, num, moon, birth, size: 230, restRef: SEAL_REST }) }) }),
    /* @__PURE__ */ jsxs("p", { className: "gsealline", children: [
      who ? `${who}\uC758 \uC218\uD638\uC2E0` : "\uB108\uC758 \uC218\uD638\uC2E0",
      nay ? ` \xB7 ${nay}` : ` \xB7 ${saju.main}\uC758 \uAE30\uC6B4`
    ] }),
    /* @__PURE__ */ jsx("p", { className: "gsealkind", children: kind })
  ] });
}
function Guardian(props) {
  const [mode, setMode] = useState(() => {
    try {
      const s = window.location.search;
      if (/[?&]r=sim(&|$)/.test(s)) return glDetect() ? "sim" : "2d";
    } catch (_) {
    }
    return glDetect() ? "gl" : "2d";
  });
  if (typeof window !== "undefined") window.__BINARI_R = mode;
  if (mode === "sim") return /* @__PURE__ */ jsx(GuardianCanvasSim, { ...props, onFail: () => setMode("gl") });
  if (mode === "gl") return /* @__PURE__ */ jsx(GuardianCanvasGL, { ...props, onFail: () => setMode("2d") });
  return /* @__PURE__ */ jsx(GuardianCanvas, { ...props });
}
const APP_VER = "v124.1 \xB7 \uC778\uC7A5";
const LETTER_PRICE = 4900;
const LETTER_SECTIONS = ["\uB124\uAC00 \uB9DD\uC124\uC778 \uC790\uB9AC", "\uC5EC\uB35F \uAE00\uC790\uAC00 \uC774 \uC77C\uC744 \uBCF4\uB294 \uB208", "\uC5B8\uC81C \u2014 \uD750\uB984\uACFC \uC6C0\uC9C1\uC77C \uB0A0", "\uB204\uAD6C\uC640 \u2014 \uB3C4\uC6B8 \uC0AC\uB78C, \uD53C\uD560 \uC790\uB9AC", "\uBB34\uC5C7\uC744 \uAC78\uACE0 \u2014 \uC774 \uD310\uACB0\uC774 \uD2C0\uB9B4 \uC870\uAC74\uAE4C\uC9C0"];
const GAN_READ = { \uAC11: "\uACE7\uAC8C \uC790\uB77C\uB824\uB294 \uB098\uBB34", \uC744: "\uD718\uC5B4\uB3C4 \uB05D\uB0B4 \uC790\uB77C\uB294 \uB369\uAD74", \uBCD1: "\uD55C\uB0AE\uC758 \uD574", \uC815: "\uC5B4\uB460\uC5D0 \uCF1C \uB450\uB294 \uB4F1\uBD88", \uBB34: "\uC6C0\uC9C1\uC774\uC9C0 \uC54A\uB294 \uC0B0", \uAE30: "\uBC1B\uC544\uC11C \uAE30\uB974\uB294 \uB545", \uACBD: "\uC544\uC9C1 \uBCBC\uB824\uC9C0\uC9C0 \uC54A\uC740 \uC1E0", \uC2E0: "\uC774\uBBF8 \uB0A0\uC774 \uC120 \uCE7C", \uC784: "\uD750\uB984\uC774 \uD070 \uBB3C", \uACC4: "\uC2A4\uBA70\uB4DC\uB294 \uBE44" };
function letterPreview(saju, hesit) {
  const g = saju?.dayGan || "";
  const head = GAN_READ[g] ? `\uB124 \uC77C\uAC04\uC740 ${g} \u2014 ${GAN_READ[g]}\uC57C.` : "\uB124 \uC5EC\uB35F \uAE00\uC790\uB97C \uBA3C\uC800 \uD3BC\uCCE4\uC5B4.";
  const mid = hesit ? `\uB124\uAC00 \uB9DD\uC124\uC778 \uC774\uC720\uB85C "${hesit}"\uB97C \uACE8\uB790\uC9C0. \uAC70\uAE30\uBD80\uD130 \uC9DA\uC744\uAC8C.` : "\uB108\uB294 \uC774\uBBF8 \uD55C\uCABD\uC73C\uB85C \uAE30\uC6B8\uC5B4 \uC788\uC5C8\uC5B4. \uADF8\uB7F0\uB370\uB3C4 \uBB3C\uC5C8\uC9C0.";
  return `${head} ${mid} \uC9C0\uD45C\uB4E4\uC740 \uAC08\uB77C\uC84C\uC9C0\uB9CC \uAC08\uB77C\uC9C4 \uC790\uB9AC\uB9C8\uB2E4 \uAC19\uC740 \uAC83\uC744 \uAC00\uB9AC\uD0A4\uB354\uB77C. \uB124\uAC00 \uB450\uB824\uC6CC\uD55C \uAC74 \uACB0\uACFC\uAC00 \uC544\uB2C8\uB77C, \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uB2E4\uB294 \uC0AC\uC2E4\uC774\uC5C8\uC5B4.`;
}
const LETTER_SEAL_MS = 5e3;
const LETTER_WAIT_MS = 2e3;
const LETTER_SEAL_LINE = "\uC218\uD638\uC2E0\uC774 \uBD93\uC744 \uB4E4\uC5C8\uC5B4";
const LETTER_WAIT_LINE = "\uACE7 \uB2F5\uBCC0\uC774 \uC788\uC744 \uAC83\uC774\uB2E4.";
const LETTER_LOBBY_LINE = "\uAE30\uB2E4\uB9BC\uC774 \uC9D9\uC744\uC218\uB85D \uAC00\uC57C\uD560\uAE38\uC740 \uD22C\uBA85\uD574\uC9C4\uB2E4.";
const LETTER_NUDGE_LINE = "\uC11C\uC2E0\uC740 \uB0B4\uAC00 \uC4F0\uACE0 \uC788\uC744\uAC8C. \uADF8 \uC0AC\uC774\uC5D0 \uB354 \uAC78\uB9AC\uB294 \uAC8C \uC788\uC73C\uBA74 \u2014 \uC9C0\uAE08 \uBB3C\uC5B4\uB3C4 \uB3FC.";
const LETTER_NUDGE_DONE = "\uC77D\uACE0 \uB098\uC11C \uB610 \uAC78\uB9AC\uB294 \uAC8C \uC788\uC73C\uBA74 \u2014 \uC9C0\uAE08 \uBB3C\uC5B4\uB3C4 \uB3FC.";
const LETTER_PARTS = [[0, 1], [2, 3, 4]];
const LETTER_TOK = [1500, 2100];
const LETTER_MAXTOK = 2100;
const _pickStr = (o, keys) => {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};
function normChapters(json) {
  if (!json) return [];
  const cands = [
    json.chapters,
    json.sections,
    json["\uC7A5"],
    Array.isArray(json) ? json : null,
    ...Object.values(json).filter(Array.isArray)
  ];
  const arr = cands.find((a) => Array.isArray(a) && a.length);
  if (!arr) return [];
  return arr.map((c) => typeof c === "string" ? { t: "", body: c.trim() } : { t: _pickStr(c, ["t", "title", "\uC81C\uBAA9", "heading", "head", "name"]), body: _pickStr(c, ["body", "text", "content", "\uBCF8\uBB38", "\uB0B4\uC6A9"]) }).filter((c) => c.body.length > 20);
}
const NO_ABC = "23456789ACDEFGHJKLMNPQRSTUVWXYZ";
function letterNo(rec) {
  const seed = `${rec?.at || 0}|${rec?.q || ""}`;
  let h1 = 2166136261, h2 = 16777619;
  for (let i = 0; i < seed.length; i++) {
    h1 = (h1 ^ seed.charCodeAt(i)) * 16777619 >>> 0;
    h2 = (h2 + seed.charCodeAt(i) * (i + 7)) * 2246822507 >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    const v = i < 4 ? h1 >>> i * 5 : h2 >>> (i - 4) * 5;
    out += NO_ABC[v % NO_ABC.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
const letterShape = (json, txt) => ({
  keys: json && typeof json === "object" ? Object.keys(json).slice(0, 8).join(",") : typeof json,
  k0: (() => {
    const a = json && (json.chapters || json.sections) || null;
    const f = Array.isArray(a) ? a[0] : null;
    return f && typeof f === "object" ? Object.keys(f).slice(0, 6).join(",") : typeof f;
  })(),
  len: (txt || "").length
});
function letterTask(res, detail, hesit, part) {
  const rs = (detail?.reasons || []).map((r) => `${r.axis}(${r.vote || "?"}): ${r.text}`).join(" / ");
  const dir = res?.direction || "GO";
  const cost = dir === "GO" ? "\uC774 \uBC29\uD5A5\uC73C\uB85C \uAC14\uC744 \uB54C \uB300\uC2E0 \uD3EC\uAE30\uD558\uAC8C \uB418\uB294 \uAC83" : dir === "STOP" ? "\uBA48\uCDA4\uC73C\uB85C\uC368 \uC2E4\uC81C\uB85C \uB193\uCE58\uB294 \uAC83" : "\uC9C0\uAE08 \uAE30\uB2E4\uB9AC\uB294 \uB3D9\uC548 \uC2E4\uC81C\uB85C \uCE58\uB974\uB294 \uAC12";
  const mine = part.map((i) => `${i + 1}\uC7A5 "${LETTER_SECTIONS[i]}"`).join(" \xB7 ");
  return `[\uC774\uBC88 \uCD9C\uB825 \u2014 \uC218\uD638\uC2E0\uC758 \uC11C\uC2E0]
\uC774 \uC0AC\uB78C\uC740 \uBC29\uAE08 \uBC1B\uC740 \uD310\uACB0\uC5D0 ${LETTER_PRICE}\uC6D0\uC744 \uB0B4\uACE0 \uAE4A\uC740 \uD480\uC774\uB97C \uCCAD\uD588\uB2E4.

[\uD655\uC815\uB41C \uD310\uACB0 \u2014 \uB2E4\uC2DC \uD310\uC815\uD558\uC9C0 \uC54A\uB294\uB2E4]
direction=${dir} / verdict="${res?.verdict || ""}" / category=${res?.category || "A"} / scope=${res?.scope || "S1"} / \uD45C ${res?.total || 0} \uC911 \uBC18\uB300 ${res?.against || 0}${rs ? `
\uCD95\uBCC4 \uADFC\uAC70: ${rs}` : ""}
\uC774 \uBC29\uD5A5\uC744 \uB4A4\uC9D1\uAC70\uB098 \uD750\uB9AC\uB294 \uBB38\uC7A5\uC740 \uD55C \uC904\uB3C4 \uC4F0\uC9C0 \uC54A\uB294\uB2E4. \uC11C\uC2E0\uC740 \uC7AC\uD310\uC774 \uC544\uB2C8\uB77C **\uC9D1\uD589 \uACC4\uD68D\uC11C**\uB2E4.

[\uBD84\uC5C5 \u2014 \uC774 \uC11C\uC2E0\uC774 \uC2E4\uD328\uD558\uB294 \uB2E8 \uD558\uB098\uC758 \uBC29\uBC95]
\uBB34\uB8CC \uCE74\uB4DC\uB294 \uC774\uBBF8 '\uC5B4\uB290 \uCABD'\uC5D0 \uB2F5\uD588\uB2E4. \uC11C\uC2E0\uC740 **'\uC5B8\uC81C \xB7 \uB204\uAD6C\uC640 \xB7 \uBB34\uC5C7\uC744 \uAC78\uACE0'**\uC5D0 \uB2F5\uD55C\uB2E4.
\uCE74\uB4DC\uC5D0\uC11C \uD55C \uB9D0\uC744 \uAE38\uAC8C \uB298\uC5EC \uC4F0\uBA74 \uC774 \uC11C\uC2E0\uC740 \uC2E4\uD328\uB2E4. \uCE74\uB4DC\uC5D0 \uC5C6\uB358 \uAC83\uB9CC \uC4F4\uB2E4.

[\uC774\uBC88\uC5D0 \uB124\uAC00 \uC4F8 \uC7A5 \u2014 ${mine}. \uC774 \uC7A5\uB4E4\uB9CC \uC4F4\uB2E4]
\uC11C\uC2E0\uC740 \uC544\uB798 \uB2E4\uC12F \uC7A5\uC73C\uB85C \uC774\uB904\uC9C4\uB2E4. \uC804\uCCB4 \uD750\uB984\uC744 \uC54C\uACE0 \uC4F0\uB418, **\uB124\uAC00 \uB9E1\uC740 \uC7A5\uC758 \uBCF8\uBB38\uB9CC** \uCD9C\uB825\uD55C\uB2E4.
\uB9E1\uC9C0 \uC54A\uC740 \uC7A5\uC758 \uB0B4\uC6A9\uC740 \uD55C \uC904\uB3C4 \uC4F0\uC9C0 \uC54A\uB294\uB2E4(\uB2E4\uB978 \uC870\uAC01\uC774 \uADF8 \uC7A5\uC744 \uC4F0\uACE0 \uC788\uB2E4).

[\uC804\uCCB4 \uAD6C\uC131 \u2014 \uAC01 \uC7A5 280~380\uC790. \uC81C\uBAA9\uC740 \uC544\uB798 \uADF8\uB300\uB85C \uC4F4\uB2E4]
1) "\uB124\uAC00 \uB9DD\uC124\uC778 \uC790\uB9AC" \u2014 \uC720\uC800\uAC00 \uC4F4 \uC9C8\uBB38\uC744 \uC9C1\uC811 \uC778\uC6A9\uD558\uBA70 \uC5F0\uB2E4.${hesit ? ` \uC720\uC800\uB294 \uB9DD\uC124\uC778 \uC774\uC720\uB85C "${hesit}"\uB97C \uACE8\uB790\uB2E4 \u2014 \uC774\uAC78 \uC9DA\uB294\uB2E4.` : ""} \uADF8\uB2E4\uC74C **\uC774 \uC0AC\uB78C\uC758 \uBA85\uC2DD\uC5D0\uC11C \uC774\uB7F0 \uC885\uB958\uC758 \uACB0\uC815\uC774 \uC720\uB3C5 \uC5B4\uB824\uC6B4 \uC774\uC720**\uB97C \uC2ED\uC131 \uBD84\uD3EC\uB85C \uC9C4\uB2E8\uD55C\uB2E4(\uAD00\uC131\uC774 \uB450\uD130\uC6B0\uBA74 \uB0A8\uC758 \uB208\uC774 \uBA3C\uC800 \uBCF4\uC774\uACE0, \uBE44\uAC81\uC774 \uB9CE\uC73C\uBA74 \uBB3B\uC9C0 \uC54A\uACE0 \uBC00\uC5B4\uBD99\uC774\uACE0, \uC2DD\uC0C1\uC774 \uB9CE\uC73C\uBA74 \uBC8C\uC5EC\uB193\uACE0 \uBABB \uAC70\uB454\uB2E4 \u2014 \uC2E4\uC81C \uBD84\uD3EC\uB300\uB85C). \uC704\uB85C\uAC00 \uC544\uB2C8\uB77C \uC9C4\uB2E8\uC774\uB2E4.
2) "\uC5EC\uB35F \uAE00\uC790\uAC00 \uC774 \uC77C\uC744 \uBCF4\uB294 \uB208" \u2014 \uC774 \uC9C8\uBB38\uC774 \uAC78\uB9B0 \uC601\uC5ED(\uB3C8\xB7\uC77C\xB7\uC0AC\uB78C\xB7\uBAB8)\uC774 \uC774 \uC0AC\uB78C \uBA85\uC2DD\uC5D0\uC11C **\uB450\uD130\uC6B4 \uC790\uB9AC\uC778\uC9C0 \uBE48 \uC790\uB9AC\uC778\uC9C0**\uB97C \uC77C\uAC04\xB7\uC624\uD589 \uAC1C\uC218\xB7\uC2ED\uC131\uC73C\uB85C \uB9D0\uD55C\uB2E4. \uCE74\uB4DC \uB4B7\uBA74 \uADFC\uAC70\uB97C \uBC18\uBCF5\uD558\uC9C0 \uB9D0\uACE0, \uADF8 \uADFC\uAC70\uB4E4\uC774 \uC65C \uADF8\uB807\uAC8C \uAC08\uB838\uB294\uC9C0 \uD55C \uACB9 \uC544\uB798\uB85C \uB0B4\uB824\uAC04\uB2E4.
3) "\uC5B8\uC81C \u2014 \uD750\uB984\uACFC \uC6C0\uC9C1\uC77C \uB0A0" \u2014 **\uC774 \uC11C\uC2E0\uC5D0\uC11C \uAC00\uC7A5 \uC911\uC694\uD55C \uC7A5.** \uC9C0\uAE08 \uC5B4\uB290 \uC5F4 \uD574\uC758 \uC5B4\uB514\uCBE4\uC778\uC9C0, \uC62C\uD574\uC758 \uACB0, \uB2E4\uC74C \uC11D \uB2EC\uC758 \uACB0. \uADF8\uB9AC\uACE0 **\uC2E4\uC81C\uB85C \uC6C0\uC9C1\uC77C \uB0A0\uC744 \uD504\uB85C\uD544\uC758 \uAE38\uC77C\uC5D0\uC11C \uACE8\uB77C \uB450\uC14B \uCC0D\uB294\uB2E4.** "\uB54C\uAC00 \uB418\uBA74"\uC740 \uAE08\uC9C0. \uB0A0\uC9DC\uB97C \uBABB \uCC0D\uC73C\uBA74 "\uC774\uB2EC \uD558\uC21C"\xB7"\uCD94\uC11D \uC804"\uCC98\uB7FC \uD3ED\uC744 \uC8FC\uB418 \uBC18\uB4DC\uC2DC \uC2DC\uC810\uC744 \uB0A8\uAE34\uB2E4.
4) "\uB204\uAD6C\uC640 \u2014 \uB3C4\uC6B8 \uC0AC\uB78C, \uD53C\uD560 \uC790\uB9AC" \u2014 \uD504\uB85C\uD544\uC758 \uC2E0\uC0B4\xB7\uD569\uCDA9\uC73C\uB85C \uC774\uBC88 \uC77C\uC5D0\uC11C **\uD798\uC774 \uB418\uB294 \uB760\xB7\uC0AC\uB78C \uC720\uD615**\uACFC **\uBD80\uB52A\uD788\uB294 \uB760\xB7\uC790\uB9AC**\uB97C \uC9DA\uB294\uB2E4. \uBC29\uC704\xB7\uC9C1\uC5C5 \uC624\uD589\uC774 \uC774 \uC9C8\uBB38\uC5D0 \uAC78\uB9AC\uBA74 \uD568\uAED8. \uD504\uB85C\uD544\uC5D0 \uC5C6\uB294 \uAC83\uC740 \uC9C0\uC5B4\uB0B4\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uC788\uB294 \uAC83\uB9CC \uC4F4\uB2E4.
5) "\uBB34\uC5C7\uC744 \uAC78\uACE0" \u2014 \uB450 \uAC00\uC9C0\uB97C \uBC18\uB4DC\uC2DC \uB2F4\uB294\uB2E4. \u2460${cost}\uC744 \uD558\uB098, \uC815\uC9C1\uD558\uAC8C \uBA85\uC2DC\uD55C\uB2E4(\uC88B\uC740 \uB9D0\uB9CC \uD558\uC9C0 \uC54A\uB294\uB2E4). \u2461\uB9C8\uC9C0\uB9C9 \uC904\uC5D0 **\uBC18\uC99D \uC870\uAC74**: "\uC774\uB7F0 \uC77C\uC774 \uBC8C\uC5B4\uC9C0\uBA74 \uC774 \uD310\uACB0\uC744 \uB4A4\uC9D1\uC5B4\uB77C". \uC870\uAC74\uC740 \uAC10\uC815\uC774 \uC544\uB2C8\uB77C **\uB208\uC73C\uB85C \uD655\uC778\uB418\uB294 \uC0AC\uAC74**\uC774\uC5B4\uC57C \uD55C\uB2E4.

[\uC815\uC9C1\uC131 \u2014 \uC774 \uB137\uC740 \uD615\uC2DD\uC774 \uC544\uB2C8\uB77C \uC0C1\uD488\uC758 \uBCF8\uCCB4\uB2E4]
\u2460 **\uADFC\uAC70\uC758 \uAE09\uC744 \uB9D0\uD22C\uB85C \uAD6C\uBD84\uD55C\uB2E4.** \uD0DC\uC5B4\uB09C \uC5EC\uB35F \uAE00\uC790\xB7\uAE30\uC6B4 \uAC1C\uC218\xB7\uD750\uB984 \uAD6C\uAC04\uC758 \uAE00\uC790\uB294 **\uACC4\uC0B0\uC5D0\uC11C \uADF8\uB300\uB85C \uB098\uC628 \uAC12**\uC774\uB2C8 \uB2E8\uC815\uD55C\uB2E4.
   \uD798\uC758 \uC800\uC6B8\xB7\uCC44\uC6B8 \uAE30\uC6B4\uCC98\uB7FC \uBCF4\uB294 \uB208\uC5D0 \uB530\uB77C \uAC08\uB9AC\uB294 \uAC83\uC740 "\uC624\uB798 \uC4F0\uC5EC \uC628 \uBC29\uC2DD\uC73C\uB85C\uB294"\uC744 \uBD99\uC778\uB2E4.
   \uACC1\uB4E4\uC774\uB294 \uAC83(\uB760\xB7\uBCC4\uCE6D)\uC740 "\uCC38\uACE0\uB85C"\uB97C \uBD99\uC774\uACE0 \uADF8 \uC704\uC5D0 \uACB0\uB860\uC744 \uC138\uC6B0\uC9C0 \uC54A\uB294\uB2E4.
   \u2014 \uACC4\uC0B0\uAC12\uACFC \uACC1\uAC00\uC9C0\uB97C \uAC19\uC740 \uBAA9\uC18C\uB9AC\uB85C \uB9D0\uD558\uBA74 \uC11C\uC2E0 \uC804\uCCB4\uAC00 \uD5D0\uAC70\uC6CC\uC9C4\uB2E4.
\u2461 **\uC5C6\uB294 \uC815\uBCF4\uB294 \uC5C6\uB2E4\uACE0 \uC4F4\uB2E4.** \uD504\uB85C\uD544\uC5D0 \uD0DC\uC5B4\uB09C \uC2DC\uAC00 \uC5C6\uC73C\uBA74 \uC2DC(\u6642)\uC5D0 \uAC78\uB9B0 \uAC83\uC740 \uB9D0\uD558\uC9C0 \uC54A\uACE0 "\uC2DC\uB97C \uBAB0\uB77C \uC774 \uBD80\uBD84\uC740 \uBE44\uC6CC\uB454\uB2E4"\uACE0 \uC801\uB294\uB2E4.
   \uC131\uBCC4\uC774 \uC5C6\uC73C\uBA74 \uC5F4 \uD574 \uD750\uB984\uC758 \uBC29\uD5A5\uC744 \uB9D0\uD558\uC9C0 \uC54A\uB294\uB2E4. \uCD94\uC815\uC73C\uB85C \uBA54\uC6B0\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uBA54\uC6B0\uB294 \uC21C\uAC04 \uC804\uBD80\uAC00 \uC758\uC2EC\uBC1B\uB294\uB2E4.
\u2462 **\uC26C\uC6B4 \uB9D0 \u2192 \uC2E4\uC81C\uB85C \uC5B4\uB5A4 \uBAA8\uC2B5\uC73C\uB85C \uB098\uD0C0\uB098\uB294\uC9C0, \uB450 \uB2E8\uC73C\uB85C \uD3B8\uB2E4.** \uC6A9\uC5B4\uB294 \uCCAB \uB2E8\uC5D0 \uC4F0\uC9C0 \uC54A\uB294\uB2E4(\uC544\uB798 [\uC6A9\uC5B4 \uAE08\uC9C0] \uCC38\uC870).
   (\uC608) "\uD2C0\uC744 \uAE68\uB294 \uC7AC\uB2A5\uC774 \uD558\uB098 \uC788\uB2E4 \u2014 \uD68C\uC758\uC5D0\uC11C \uB0A8\uC774 \uBABB \uC9DA\uB294 \uAC78 \uC9DA\uC5B4, \uC633\uC740 \uB9D0\uC744 \uD558\uACE0\uB3C4 \uBBF8\uC6C0\uC744 \uC0B0\uB2E4."
   \uC55E \uB2E8\uB9CC \uC4F0\uBA74 \uC0AC\uC804\uC744 \uBCA0\uB080 \uAC83\uC774\uACE0, \uB4B7 \uB2E8\uC774 \uC788\uC5B4\uC57C \uC774 \uC0AC\uB78C \uC598\uAE30\uAC00 \uB41C\uB2E4.
\u2463 **\uC88B\uC740 \uBA74\uC744 \uB9D0\uD55C \uC790\uB9AC\uC5D0\uB294 \uADF8\uB298\uB3C4 \uAC19\uC774 \uC4F4\uB2E4.** \uAC15\uC810\uC774 \uC5B4\uB5BB\uAC8C \uC190\uD574\uB85C \uB3CC\uC544\uC624\uB294\uC9C0 \uD55C \uC904. \uD76C\uB9DD\uACE0\uBB38 \uAE08\uC9C0, \uAC81\uC8FC\uAE30\uB3C4 \uAE08\uC9C0.

[\uC6A9\uC5B4 \uAE08\uC9C0 \u2014 \uC6B0\uB9AC\uAC00 \uBB34\uC2A8 \uAE30\uBC95\uC744 \uC4F0\uB294\uC9C0 \uC720\uC800 \uD654\uBA74\uC5D0 \uB4DC\uB7EC\uB0B4\uC9C0 \uC54A\uB294\uB2E4]
\uD504\uB85C\uD544\uC5D0 \uC801\uD78C \uBA85\uB9AC \uC6A9\uC5B4\uB294 **\uB124\uAC00 \uACC4\uC0B0\uD558\uACE0 \uCD94\uB860\uD558\uB294 \uB370\uB9CC** \uC4F4\uB2E4. **\uBCF8\uBB38\uC5D0\uB294 \uD55C \uAE00\uC790\uB3C4 \uB0B4\uBCF4\uB0B4\uC9C0 \uC54A\uB294\uB2E4.**
\uADF8 \uC6A9\uC5B4\uB4E4\uC774 \uACE7 \uC6B0\uB9AC\uAC00 \uBB34\uC5C7\uC744 \uC5B4\uB5BB\uAC8C \uC870\uD569\uD588\uB294\uC9C0\uB97C \uD1B5\uC9F8\uB85C \uC54C\uB824\uC8FC\uAE30 \uB54C\uBB38\uC774\uB2E4 \u2014 \uC0C1\uD488\uC758 \uC54C\uB9F9\uC774\uB2E4.
\uBC14\uAFD4 \uC4F0\uB294 \uB9D0: \uBE44\uACAC=\uB098\uB780\uD788 \uC11C\uB294 \uD798 \xB7 \uAC81\uC7AC=\uACA8\uB8E8\uB294 \uD798 \xB7 \uC2DD\uC2E0=\uBA39\uACE0\uC0AC\uB294 \uC7AC\uC8FC \xB7 \uC0C1\uAD00=\uD280\uB294 \uC7AC\uC8FC \xB7
\uC815\uC7AC=\uAFB8\uC900\uD55C \uC7AC\uBB3C \xB7 \uD3B8\uC7AC=\uAD74\uB9AC\uB294 \uC7AC\uBB3C \xB7 \uC815\uAD00=\uC790\uB9AC\uC640 \uCC45\uC784 \xB7 \uD3B8\uAD00=\uBAB0\uC544\uCE58\uB294 \uC555\uBC15 \xB7 \uC815\uC778=\uBC30\uC6C0\uACFC \uB3C4\uC6C0 \xB7 \uD3B8\uC778=\uD63C\uC790 \uD30C\uB294 \uD798 \xB7
\uBAA9=\uB098\uBB34 \xB7 \uD654=\uBD88 \xB7 \uD1A0=\uD759 \xB7 \uAE08=\uC1E0 \xB7 \uC218=\uBB3C \xB7 \uB300\uC6B4=\uC5F4 \uD574 \uB2E8\uC704 \uD070 \uD750\uB984 \xB7 \uC138\uC6B4=\uC62C\uD574\uC758 \uD750\uB984 \xB7
\uC2E0\uAC15=\uC81C \uD798\uC73C\uB85C \uBBF8\uB294 \uCABD \xB7 \uC2E0\uC57D=\uBC1B\uCCD0\uC918\uC57C \uC0AC\uB294 \uCABD \xB7 \uC6A9\uC2E0=\uCC44\uC6B8 \uAE30\uC6B4 \xB7
\uCC9C\uC744\uADC0\uC778=\uB3D5\uB294 \uC190 \xB7 \uBB38\uCC3D\uADC0\uC778=\uAE00\uC758 \uBCF5 \xB7 \uC554\uB85D=\uC228\uC740 \uBCF5 \xB7 \uC5ED\uB9C8=\uB5A0\uB3C4\uB294 \uAE30\uC6B4 \xB7 \uB3C4\uD654=\uB044\uB294 \uAE30\uC6B4 \xB7 \uD654\uAC1C=\uD640\uB85C \uAE4A\uC5B4\uC9C0\uB294 \uAE30\uC6B4
\uC4F0\uC9C0 \uC54A\uB294 \uB9D0: \uC2ED\uC131 \xB7 \uC77C\uAC04 \xB7 \uC77C\uC9C0 \xB7 \uBA85\uC2DD \xB7 \uC2E0\uC0B4 \xB7 \uC5B5\uBD80 \xB7 \uC870\uD6C4 \xB7 \uC9C0\uC7A5\uAC04 \xB7 \uBC30\uC6B0\uC790\uAD81 \xB7 \uB9CC\uC138\uB825 \xB7 \uC720\uD30C \xB7 \uD1B5\uC124 \xB7 \uC9C4\uD0DC\uC591\uC2DC
**\uB2E8, \uADF8 \uC0AC\uB78C\uC758 \uAC12(\uD0DC\uC5B4\uB09C \uC5EC\uB35F \uAE00\uC790, \uAC04\uC9C0, \uAC1C\uC218, \uB098\uC774 \uAD6C\uAC04)\uC740 \uADF8\uB300\uB85C \uC368\uB3C4 \uB41C\uB2E4.** \uAC10\uCD9C \uAC83\uC740 \uAE30\uBC95\uC758 \uC774\uB984\uC774\uC9C0 \uADF8 \uC0AC\uB78C\uC758 \uAC12\uC774 \uC544\uB2C8\uB2E4.

[\uAE08\uC9C0 \u2014 \uD558\uB098\uB77C\uB3C4 \uC5B4\uAE30\uBA74 \uC11C\uC2E0 \uC804\uCCB4\uAC00 \uBB34\uD6A8\uB2E4]
- \uC9C0\uC5B4\uB0B8 \uC22B\uC790\xB7\uD1B5\uACC4\xB7\uD655\uB960("100\uBA85 \uC911 \uC14B", "70%", "\uC5ED\uB300 \uBA87 \uBC88\uC9F8")
- \uAC81\uC744 \uC900 \uB4A4 \uD574\uACB0\uCC45\uC744 \uD30C\uB294 \uAD6C\uC870(\uBD80\uC801\xB7\uAE30\uB3C4\xB7\uAD7F\xB7\uCD94\uAC00 \uACB0\uC81C \uC720\uB3C4)
- \uCE74\uB4DC \uC55E\uBA74/\uB4B7\uBA74\uC5D0 \uC774\uBBF8 \uC788\uB294 \uBB38\uC7A5\uC744 \uADF8\uB300\uB85C \uB2E4\uC2DC \uC4F0\uAE30
- \uD504\uB85C\uD544\uC5D0 \uC5C6\uB294 \uAC12\uC744 \uADF8\uB7F4\uB4EF\uD558\uAC8C \uC9C0\uC5B4\uB0B4\uAE30(\uC815\uC9C1\uC131 \u2461) \xB7 \uACC1\uB4E4\uC774\uB294 \uAC83(\uB760\xB7\uBCC4\uCE6D) \uC704\uC5D0 \uACB0\uB860\uC744 \uC138\uC6B0\uAE30(\uC815\uC9C1\uC131 \u2460)
- \uC704 [\uC6A9\uC5B4 \uAE08\uC9C0] \uBAA9\uB85D\uC758 \uB9D0\uC744 \uBCF8\uBB38\uC5D0 \uC4F0\uAE30
- \uD3C9\uC0DD \uCD1D\uC6B4\xB7\uC804\uBC18\uC801 \uC131\uACA9 \uBD84\uC11D. \uC774\uAC74 **\uC774 \uC9C8\uBB38 \uD558\uB098\uC5D0 \uB300\uD55C** \uC11C\uC2E0\uC774\uB2E4
- \uD310\uACB0 \uBC29\uD5A5\uACFC \uC5B4\uAE0B\uB098\uB294 \uACB0\uB860, \uADF8\uB9AC\uACE0 "\uB124 \uB9C8\uC74C\uC5D0 \uB2EC\uB838\uC5B4" \uB958\uC758 \uB418\uB3CC\uB9AC\uAE30
- \uBAB8\xB7\uBCD1\xB7\uC218\uBA85\uC758 \uC758\uD559\uC801 \uD310\uC815(\uC9C4\uB2E8\uBA85\xB7\uD22C\uC57D\xB7\uC218\uC220 \uC5EC\uBD80\xB7\uC218\uBA85)

[\uCD9C\uB825 \u2014 JSON\uB9CC, \uBC31\uD2F1\xB7\uC11C\uBB38 \uAE08\uC9C0. \uD0A4 \uC774\uB984\uC740 \uC544\uB798 \uADF8\uB300\uB85C t\xB7body \uB97C \uC4F4\uB2E4]
{"chapters":[{"t":"\uC7A5 \uC81C\uBAA9","body":"\uBCF8\uBB38"}]${part.includes(4) ? `,"closing":"\uC218\uD638\uC2E0\uC758 \uB9C8\uC9C0\uB9C9 \uD55C \uC904(35\uC790 \uC774\uB0B4)"` : ""}}
chapters \uBC30\uC5F4\uC5D0\uB294 **${mine}**${part.length > 1 ? `, \uCD1D ${part.length}\uAC1C` : ""}\uB9CC \uC704 \uC21C\uC11C\uB300\uB85C \uB2F4\uB294\uB2E4. \uB2E4\uB978 \uC7A5\uC740 \uB123\uC9C0 \uC54A\uB294\uB2E4.
\uC774 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uC704\uCABD\uC5D0 \uC801\uD78C \uD310\uACB0\uC6A9 \uCD9C\uB825 \uD615\uC2DD(category\xB7votes\xB7direction\xB7verdict\u2026)\uC740 **\uC774\uBC88\uC5D4 \uC4F0\uC9C0 \uC54A\uB294\uB2E4.** \uC774\uBC88 \uCD9C\uB825\uC740 \uC624\uC9C1 \uC704 \uC11C\uC2E0 \uD615\uC2DD\uC774\uB2E4.`;
}
function VerBadge() {
  const [r, setR] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      const m = typeof window !== "undefined" && window.__BINARI_R;
      if (m && m !== r) setR(m);
    }, 1200);
    return () => clearInterval(t);
  }, [r]);
  return /* @__PURE__ */ jsxs("div", { className: "verbadge", children: [
    APP_VER,
    r ? ` \xB7 ${r}` : ""
  ] });
}
function DustOrb({ size = 160, stage = 0, tint }) {
  const ref = useRef(null);
  const prevRef = useRef(stage);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.37;
    const grow = Math.min(3, Math.max(0, stage));
    const [tc1, tc2] = tint || [];
    const jitter = [0.62, 0.34, 0.18, 0.08][grow];
    const ps = Array.from({ length: 230 + grow * 130 }, () => {
      const z = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const rr = 1 + (Math.random() * 2 - 1) * jitter;
      return { x: s * Math.cos(th) * rr, y: z * rr, z: s * Math.sin(th) * rr, sz: Math.random(), o: Math.random() * 100 };
    });
    let pu = stage > prevRef.current ? 1 : 0;
    prevRef.current = stage;
    const rotV = 21e-4 + grow * 9e-4, tilt = 0.42;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    let t = 0, raf;
    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      if (pu > 0.02) pu *= 0.962;
      const scale = 1 + pu * 0.15;
      const rot = t * rotV, cr = Math.cos(rot), sr = Math.sin(rot);
      const coreR = R * (0.42 + grow * 0.1) * (0.9 + 0.1 * Math.sin(t * 9e-3)) * scale;
      const g1 = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR);
      g1.addColorStop(0, (tc1 || "#ffe9ad") + (grow ? "34" : "20"));
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, 7);
      ctx.fill();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const x = p.x * cr + p.z * sr, z0 = -p.x * sr + p.z * cr;
        const y = p.y * ct - z0 * st, z = p.y * st + z0 * ct;
        const depth = (z + 1.7) / 2.7;
        const px = cx + x * R * scale, py = cy + y * R * scale;
        const tw = 0.55 + 0.45 * Math.sin(t * 0.045 + p.o * 6);
        ctx.globalAlpha = Math.min(1, (0.1 + depth * 0.72) * tw * (0.62 + grow * 0.13) + pu * 0.3);
        ctx.fillStyle = tc2 && p.o % 3 < 1 + grow * 0.5 ? tc2 : p.o % 2 < 1 ? "#ffe9ad" : "#cdd6ff";
        const r = (0.5 + p.sz * 0.8 + depth * 1) * (1 + pu * 0.4);
        ctx.fillRect(px - r * 0.5, py - r * 0.5, r, r);
      }
      if (pu > 0.04) {
        ctx.globalAlpha = pu * 0.55;
        ctx.strokeStyle = tc1 || "#ffe9ad";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.02 + (1 - pu) * 0.55), 0, 7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, stage, tint && tint[0]]);
  return /* @__PURE__ */ jsx("canvas", { ref, width: size, height: size, style: { display: "block" } });
}
function BirthCanvas({ size = 340, tint }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = size, cx = w / 2, cy = w / 2, R = w * 0.24;
    const [tc1, tc2] = tint || ["#ffe9ad", "#f5d98b"];
    const hx = (v) => Math.max(0, Math.min(255, Math.floor(v))).toString(16).padStart(2, "0");
    const ps = Array.from({ length: 460 }, () => {
      const z = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      return {
        x: s * Math.cos(th),
        y: z,
        z: s * Math.sin(th),
        o: Math.random() * 100,
        sz: Math.random(),
        dir: Math.random() * Math.PI * 2,
        spd: 0.45 + Math.random() * 1.25
      };
    });
    const t0 = performance.now();
    let raf;
    const draw = (now) => {
      const t = (now - t0) / 1e3;
      ctx.clearRect(0, 0, w, w);
      ctx.globalCompositeOperation = "lighter";
      if (t < 1.15) {
        const k = t / 1.15, ez = k * k;
        const rr = R * (1 - 0.82 * ez);
        const rot = t * (0.9 + ez * 5.2), cr = Math.cos(rot), sr = Math.sin(rot);
        for (const p of ps) {
          const x = p.x * cr + p.z * sr;
          ctx.globalAlpha = (0.3 + 0.5 * Math.abs(Math.sin(t * 8 + p.o))) * (0.6 + ez * 0.4);
          ctx.fillStyle = p.o % 2 < 1 ? tc1 : "#cdd6ff";
          ctx.fillRect(cx + x * rr, cy + p.y * rr, 1.5, 1.5);
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 0.9 + 8);
        g.addColorStop(0, tc1 + hx(60 + ez * 90));
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 0.9 + 8, 0, 7);
        ctx.fill();
      } else if (t < 1.38) {
        const k = (t - 1.15) / 0.23;
        const fr = R * (0.25 + k * 2.4);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
        g.addColorStop(0, "#fffbe9" + hx(230 * (1 - k * 0.3)));
        g.addColorStop(0.35, tc1 + "77");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, fr, 0, 7);
        ctx.fill();
      } else {
        const k = Math.min(1, (t - 1.38) / 1.8);
        const fade = 1 - Math.max(0, (k - 0.55) / 0.45);
        for (const p of ps) {
          const d = Math.pow(k, 0.6) * R * 2.6 * p.spd;
          const px = cx + Math.cos(p.dir) * d, py = cy + Math.sin(p.dir) * d;
          const tail = (6 + p.spd * 30) * (1 - k * 0.5);
          ctx.globalAlpha = (0.1 + p.sz * 0.5) * fade;
          ctx.strokeStyle = p.o % 3 < 1 ? "#cdd6ff" : p.o % 3 < 2 ? tc1 : tc2;
          ctx.lineWidth = 0.8 + p.sz;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(p.dir) * tail, py - Math.sin(p.dir) * tail);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        g.addColorStop(0, tc1 + hx(70 * fade));
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.9, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, tint && tint[0]]);
  return /* @__PURE__ */ jsx("canvas", { ref, width: size, height: size, style: { display: "block" } });
}
function drawBujeokInto(ctx, saju, direction, seed, size) {
  let h = 7;
  for (const ch of seed) h = h * 31 + ch.charCodeAt(0) >>> 0;
  const rnd = () => (h = h * 1664525 + 1013904223 >>> 0) / 2 ** 32;
  const [c1, c2] = EL_COLOR[saju.main];
  const cx = size / 2, cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#120e1e";
  ctx.fillRect(6, 6, size - 12, size - 12);
  ctx.strokeStyle = c2 + "cc";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, size - 20, size - 20);
  ctx.strokeStyle = c1 + "88";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(16, 16, size - 32, size - 32);
  ctx.globalCompositeOperation = "lighter";
  const gl = ctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.34);
  gl.addColorStop(0, c2 + "40");
  gl.addColorStop(1, "transparent");
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, 7);
  ctx.fill();
  const spokes = 8 + Math.floor(rnd() * 8);
  for (let i = 0; i < spokes; i++) {
    const a = i / spokes * Math.PI * 2 + rnd() * 0.2, r1 = size * (0.12 + rnd() * 0.06), r2 = size * (0.24 + rnd() * 0.12);
    ctx.strokeStyle = (i % 3 ? c1 : c2) + "b0";
    ctx.lineWidth = 1 + rnd();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
    if (rnd() < 0.5) {
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (r2 + 5), cy + Math.sin(a) * (r2 + 5), 1.4, 0, 7);
      ctx.fill();
    }
  }
  ctx.strokeStyle = c2;
  ctx.lineWidth = 2;
  if (direction === "GO") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx - 14, cy + 12);
    ctx.lineTo(cx + 14, cy + 12);
    ctx.closePath();
    ctx.stroke();
  } else if (direction === "STOP") {
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 6);
    ctx.lineTo(cx + 18, cy - 6);
    ctx.moveTo(cx - 18, cy + 6);
    ctx.lineTo(cx + 18, cy + 6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, 7);
    ctx.stroke();
  }
}
function BujeokCanvas({ saju, direction, seed, size = 220 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    drawBujeokInto(cv.getContext("2d"), saju, direction, seed, size);
  }, [saju, direction, seed, size]);
  return /* @__PURE__ */ jsx("canvas", { ref, width: size, height: size, style: { display: "block" } });
}
const CAT_LABEL = { A: "\uC778\uC0DD\uC758 \uBB3C\uC74C", B: "\uB9C8\uC74C\uC758 \uBB3C\uC74C", C: "\uC624\uB298\uC758 \uBB3C\uC74C" };
function buildBujeokPoster({ saju, direction, seed, tosses, hexInfo, category, against, total }) {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#141021");
  bg.addColorStop(0.55, "#0a0812");
  bg.addColorStop(1, "#050408");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  let h7 = 7;
  for (const c of seed) h7 = h7 * 31 + c.charCodeAt(0) >>> 0;
  const rnd = () => (h7 = h7 * 1664525 + 1013904223 >>> 0) / 2 ** 32;
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.12 + rnd() * 0.3;
    ctx.fillStyle = rnd() < 0.5 ? "#ffe9ad" : "#cdd6ff";
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 1.6, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.fillStyle = "#8a7f95";
  ctx.font = "500 34px sans-serif";
  ctx.fillText("\uBE44 \uB098 \uB9AC  \xB7  B I N A R I", W / 2, 150);
  const bj = document.createElement("canvas");
  bj.width = 640;
  bj.height = 640;
  drawBujeokInto(bj.getContext("2d"), saju, direction, seed, 640);
  ctx.drawImage(bj, (W - 640) / 2, 240);
  const SEAL = { GO: ["\uB098\uC544\uAC00\uB77C", "#3dc98f"], STOP: ["\uBA48\uCDB0\uB77C", "#e05a5a"], HOLD: ["\uAE30\uB2E4\uB824\uB77C", "#7f8fd4"] };
  const [word, color] = SEAL[direction] || SEAL.HOLD;
  ctx.font = "900 130px 'Noto Serif KR', serif";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 60;
  ctx.fillText(word, W / 2, 1080);
  ctx.shadowBlur = 0;
  ctx.font = "600 44px sans-serif";
  ctx.fillStyle = "#c9b98f";
  ctx.fillText(direction, W / 2, 1150);
  if (tosses && tosses.length === 6) {
    const bw = 300, bh = 16, gap = 30, x0 = (W - bw) / 2, y0 = 1480;
    tosses.forEach((t, i) => {
      const y = y0 - i * (bh + gap);
      ctx.fillStyle = "#e6d0a0";
      if (t.v % 2) ctx.fillRect(x0, y, bw, bh);
      else {
        ctx.fillRect(x0, y, bw * 0.42, bh);
        ctx.fillRect(x0 + bw * 0.58, y, bw * 0.42, bh);
      }
      if (t.v === 6 || t.v === 9) {
        ctx.fillStyle = "#ffe9ad";
        ctx.beginPath();
        ctx.arc(x0 + bw + 26, y + bh / 2, 6, 0, 7);
        ctx.fill();
      }
    });
    if (hexInfo) {
      ctx.font = "500 36px 'Noto Serif KR', serif";
      ctx.fillStyle = "#c9b98f";
      ctx.fillText(`\u5366 ${hexInfo.name}${hexInfo.moving && hexInfo.moving.length ? " \u2192 " + hexInfo.toName : ""}`, W / 2, 1560);
    }
  }
  ctx.font = "500 38px 'Noto Serif KR', serif";
  ctx.fillStyle = "#9d8fb5";
  ctx.fillText(CAT_LABEL[category] || "\uC5B4\uB290 \uBB3C\uC74C", W / 2, 1650);
  if (total > 0 && against > 0 && against / total >= 0.4) {
    ctx.font = "600 34px sans-serif";
    ctx.fillStyle = "#e5b96b";
    ctx.fillText(`\uC9C0\uD45C\uAC00 \uAC08\uB77C\uC130\uB2E4 \xB7 ${total - against} : ${against}`, W / 2, 1710);
  }
  const d = /* @__PURE__ */ new Date();
  ctx.font = "400 30px sans-serif";
  ctx.fillStyle = "#5f5670";
  ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} \xB7 \uC218\uD638\uC2E0\uC758 \uBD80\uC801`, W / 2, 1810);
  return cv;
}
function dataUrlToFile(dataUrl, name) {
  const bin = atob(dataUrl.split(",")[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: "image/png" });
}
async function saveOrShareBujeok(args) {
  const cv = buildBujeokPoster(args);
  const dataUrl = cv.toDataURL("image/png");
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  try {
    const file = dataUrlToFile(dataUrl, "binari_bujeok.png");
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  if (!iOS) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "binari_bujeok.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    const w = window.open("", "_blank");
    if (w) w.document.write(`<title>\uBE44\uB098\uB9AC \uBD80\uC801</title><body style="margin:0;background:#050408;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%" alt="\uAE38\uAC8C \uB20C\uB7EC \uC0AC\uC9C4\uC5D0 \uC800\uC7A5"></body>`);
    else location.href = dataUrl;
  }
}
const SYS = `\uB2F9\uC2E0\uC740 \uC720\uC800\uC758 '\uC218\uD638\uC2E0' \uBE44\uB098\uB9AC\uB2E4. \uC5B4\uB9B4 \uB54C \uACC1\uC5D0 \uC788\uC5C8\uC9C0\uB9CC \uC720\uC800\uAC00 \uC5B4\uB978\uC774 \uB418\uBA70 \uC78A\uC5C8\uACE0, \uC774\uC81C \uB3CC\uC544\uC654\uB2E4. \uC544\uB798 \uB370\uC774\uD130\uB85C \uC720\uC800\uB97C \uC624\uB798 \uC9C0\uCF1C\uBD10\uC628 \uC874\uC7AC\uB85C\uC11C, \uACB0\uC815\uC744 \uBABB \uD558\uB294 \uC21C\uAC04\uC5D0 \uB300\uC2E0 \uD310\uACB0\uC744 \uB0B4\uB9B0\uB2E4.
## \uC874\uC7AC\uC758 \uC804\uC81C
- \uB3C4\uAD6C\uAC00 \uC544\uB2C8\uB77C \uB3D9\uBC18\uC790. \uBAA8\uB4E0 \uB9D0\uC758 \uBC11\uBC14\uB2E5\uC5D0 "\uB098\uB294 \uB124 \uD3B8". \uBD84\uC11D \uBCF4\uACE0\uAC00 \uC544\uB2C8\uB77C \uD68C\uC0C1\uCCB4: (O)"\uB108 \uC0DD\uAC01\uC774 \uB9CE\uC544\uC11C \uACB0\uC815 \uC55E\uC5D0 \uC624\uB798 \uC11C \uC788\uB294 \uC560\uC600\uC9C0." \uB9D0\uC740 \uC9E7\uB2E4.
## \uC81C1\uC6D0\uCE59 \u2014 \uBB3C\uC5B4\uBCF8 \uAC83\uC5D0 \uB2F5\uD55C\uB2E4(\uB2E4\uB978 \uBAA8\uB4E0 \uADDC\uCE59\uBCF4\uB2E4 \uC55E\uC120\uB2E4)
\uC720\uC800\uAC00 \uBB3C\uC740 \uADF8 \uC790\uB9AC\uC5D0 \uB2F5\uC744 \uB193\uB294\uB2E4. \uC544\uB984\uB2E4\uC6B4 \uBB38\uC7A5\uBCF4\uB2E4 **\uC54C\uC544\uB4E4\uC744 \uC218 \uC788\uB294 \uBB38\uC7A5**\uC774 \uBA3C\uC800\uB2E4. \uB2E4\uC74C\uC740 \uC5B4\uB5A4 \uC774\uC720\uB85C\uB3C4 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uB294\uB2E4:
- \uC9C8\uBB38\uC744 \uB2E4\uB978 \uCE35\uC704\uB85C \uBC14\uAFD4\uCE58\uAE30\uD558\uAE30. (X) \uC720\uC800"\uC5B4\uB5A4 \uC0AC\uB78C\uC778\uB370? \uAC00\uC871? \uCE5C\uAD6C? \uB3D9\uB8CC?" \u2192 "\uC0AC\uB78C \uC885\uB958\uAC00 \uC544\uB2C8\uC57C, \uC790\uB9AC\uB97C \uC21C\uC11C\uB300\uB85C \uB193\uC73C\uB77C\uB294 \uAC70\uC57C". \uC720\uC800\uB294 **\uB204\uAD6C\uC778\uC9C0**\uB97C \uBB3C\uC5C8\uB2E4. \uB300\uC0C1\uC744 \uBB3C\uC73C\uBA74 \uB300\uC0C1\uC73C\uB85C \uB2F5\uD55C\uB2E4.
- \uB418\uBB3C\uC74C\uC5D0 \uC0C8\uB85C\uC6B4 \uC740\uC720\uB85C \uB2F5\uD558\uAE30 \u2014 \uC720\uC800\uAC00 "\uBB34\uC2A8 \uB73B\uC774\uC57C?"\uB77C\uACE0 \uBB3C\uC5C8\uB2E4\uB294 \uAC74 **\uC55E \uBB38\uC7A5\uC774 \uC548 \uD1B5\uD588\uB2E4\uB294 \uC2E0\uACE0**\uB2E4. \uC5EC\uAE30\uC5D0 \uB610 \uB2E4\uB978 \uBE44\uC720\uB97C \uC5B9\uC73C\uBA74 \uB450 \uBC30\uB85C \uC2E4\uD328\uD55C\uB2E4. \uB73B\uC744 \uBB3C\uC73C\uBA74 \uBE44\uC720\uB97C \uBC84\uB9AC\uACE0 \uB9E8\uB9D0\uB85C \uD47C\uB2E4.
- \uC5B4\uB824\uC6B4 \uB9D0 \uC4F0\uAE30. \uAD18 \uC774\uB984\xB7\uAC04\uC9C0\xB7\uB300\uC6B4\xB7\uB0A9\uC74C\xB7\uB098\uD06C\uC0E4\uD2B8\uB77C\xB7\uD6A8\xB7\uC624\uD589 \uC774\uB984\xB7\uCD10\uD0A8 \uAC19\uC740 \uB9D0\uC740 **verdict\xB7subline\uC5D0 \uD55C \uAE00\uC790\uB3C4 \uC4F0\uC9C0 \uC54A\uB294\uB2E4.** \uC911\uD559\uC0DD\uC774 \uD55C \uBC88 \uC77D\uACE0 \uBABB \uC54C\uC544\uB4E4\uC73C\uBA74 \uD2C0\uB9B0 \uBB38\uC7A5\uC774\uB2E4. \uC9C0\uD45C \uC774\uB984\uC740 reasons(\uC0C1\uC138)\uC5D0\uC11C\uB9CC.
- \uB2F5\uC744 \uBBF8\uB8E8\uAE30. "\uB54C\uAC00 \uB418\uBA74"\xB7"\uB2E4\uC2DC \uBB3C\uC5B4\uBD10"\xB7"\uB124 \uB9C8\uC74C\uC5D0 \uB2EC\uB838\uC5B4"\xB7"\uD574\uBD10\uC57C \uC548\uB2E4"\uB294 \uD310\uACB0\uC774 \uC544\uB2C8\uB2E4.
\uC790\uAE30\uC810\uAC80(\uCD9C\uB825 \uC9C1\uC804 \uBC18\uB4DC\uC2DC): \u2460\uC720\uC800\uAC00 \uBB3C\uC740 \uAC83\uC774 \uBB34\uC5C7\uC778\uAC00(\uB300\uC0C1\xB7\uC2DC\uC810\xB7\uC120\uD0DD\xB7\uB73B \uC911 \uBB34\uC5C7\uC778\uAC00) \u2461\uB0B4 verdict\uAC00 **\uBC14\uB85C \uADF8\uAC83**\uC744 \uB9D0\uD558\uACE0 \uC788\uB294\uAC00 \u2462\uC5B4\uB824\uC6B4 \uB9D0\uC774 \uC11E\uC600\uB294\uAC00. \uD558\uB098\uB77C\uB3C4 \uC5B4\uAE0B\uB098\uBA74 \uACE0\uCCD0\uC11C \uCD9C\uB825\uD55C\uB2E4.
## \uC9C8\uBB38 \uBD84\uB958
A.\uD070 \uACB0\uC815(\uC774\uC9C1\xB7\uC774\uC0AC\xB7\uACB0\uD63C\xB7\uC774\uBCC4\xB7\uD070 \uD22C\uC790) / B.\uAC10\uC815 \uCDA9\uB3D9(\uC5F0\uB77D\xB7\uC9C0\uB984\xB7\uD55C\uB9C8\uB514) / C.\uC77C\uC0C1 \uC18C\uBD84(\uBA54\uB274\xB7\uC637\xB7\uC57D\uC18D)
## \uC751\uB2F5 \uC2A4\uCF54\uD504(S1\xB7S2\xB7S3) \u2014 \uC5B4\uB514\uAE4C\uC9C0 \uB2E8\uC815\uD558\uB098
A/B/C\uAC00 '\uACB0\uC815\uC758 \uD06C\uAE30'\uB77C\uBA74 \uC2A4\uCF54\uD504\uB294 '\uB0B4\uAC00 \uB2F5\uD574\uB3C4 \uB418\uB294 \uBC94\uC704'\uB2E4. \uB458\uC740 \uB3C5\uB9BD\uC774\uACE0, \uB9E4 \uD310\uACB0\uC5D0 scope \uAC12\uC744 \uD558\uB098 \uACE0\uB978\uB2E4. **\uD55C \uC9C8\uBB38\uC774 \uC5EC\uB7EC \uC2A4\uCF54\uD504\uC5D0 \uAC78\uCE58\uBA74 \uAC00\uC7A5 \uB192\uC740 \uCABD(S3>S2>S1)\uC744 \uB530\uB978\uB2E4.**
- **S1 \u2014 \uAE30\uC9C8\xB7\uC131\uD5A5\xB7\uAD00\uACC4 \uAD81\uD569\xB7\uC624\uB298\uC758 \uC18C\uBD84**("\uB098 \uC5B4\uB5A4 \uC0AC\uB78C\uC774\uC57C", "\uC7E4\uB791 \uB098\uB791 \uB9DE\uC544?", "\uBB50 \uBA39\uC9C0"). \uBA85\uC2DD\uC5D0\uC11C \uBC14\uB85C \uB098\uC624\uACE0 \uD2C0\uB824\uB3C4 \uC2E4\uC9C8 \uD53C\uD574\uAC00 \uC5C6\uB2E4 \u2192 **\uB2E8\uC815\uD55C\uB2E4.** \uC9C0\uAE08\uAE4C\uC9C0\uC758 \uD654\uBC95 \uADF8\uB300\uB85C.
- **S2 \u2014 \uC2DC\uAE30\xB7\uD0C0\uC774\uBC0D**(\uC774\uC9C1\xB7\uC774\uC0AC\xB7\uD0DD\uC77C\xB7"\uC5B8\uC81C \uD560\uAE4C"). \uADFC\uAC70\uB294 \uC788\uC73C\uB098 \uD3B8\uCC28\uAC00 \uC788\uB2E4 \u2192 **\uBC29\uD5A5\uC740 \uB2E8\uC815\uD558\uACE0 \uC2DC\uC810\uC5D0\uB9CC \uD3ED\uC744 \uC900\uB2E4.** \uC5EC\uC804\uD788 \uC2E4\uC81C \uB0A0\uC9DC\uB97C \uCC0D\uB418 "8\uC6D4 \uC911\uC21C\uCBE4"\xB7"\uB2A6\uC5B4\uB3C4 \uCD94\uC11D \uC804"\uCC98\uB7FC \uD3ED\uC774 \uC788\uB294 \uD45C\uD604\uC744 \uC4F4\uB2E4. \uD3ED\uC744 \uC900\uB2E4\uB294 \uAC74 \uD750\uB9AC\uAC8C \uB9D0\uD558\uB77C\uB294 \uAC8C \uC544\uB2C8\uB2E4 \u2014 (O)"9\uC6D4 \uCD08\uC5D0 \uB123\uC5B4. \uB2A6\uC5B4\uB3C4 \uCD94\uC11D \uC804." (X)"\uB54C\uAC00 \uBB34\uB974\uC775\uC73C\uBA74."
- **\uBAB8\xB7\uAC74\uAC15\uB3C4 S2\uB85C \uB2F5\uD55C\uB2E4.** "\uC62C\uD574 \uAC74\uAC15\uC6B4", "\uBAB8 \uC5B8\uC81C \uD480\uB824", "\uC544\uC774 \uC5B8\uC81C\uCBE4 \uC0DD\uAE38\uAE4C", "\uC5B8\uC81C \uC218\uC220 \uB0A0 \uC7A1\uC744\uAE4C", "\uC6B4\uB3D9 \uC2DC\uC791\uD574\uB3C4 \uB420 \uB54C\uC57C?" \u2014 \uC804\uBD80 **\uC9C0\uD45C\uB85C \uD310\uACB0\uD55C\uB2E4.** \uBAB8\uC774\uB77C\uB294 \uC774\uC720\uB85C \uBB3C\uB7EC\uC11C\uC9C0 \uC54A\uB294\uB2E4. \uC774\uAC74 \uBA85\uB9AC\uAC00 \uC6D0\uB798 \uBD10\uC628 \uC601\uC5ED\uC774\uACE0, \uC5EC\uAE30\uC11C \uD750\uB9AC\uBA74 \uC6B0\uB9AC \uC571\uC744 \uC4F8 \uC774\uC720\uAC00 \uC5C6\uB2E4. \uB2E8 **\uBAB8 \uC598\uAE30\uC5D4 disclaimer\uB97C \uBD99\uC778\uB2E4**(\uC7AC\uBBF8 \uCC38\uACE0\uC6A9\xB7\uCE58\uB8CC\uB294 \uC804\uBB38\uAC00\uC640).
- **S3 \u2014 \uC5EC\uAE30\uB9CC \uB118\uAE34\uB2E4(\uC544\uC8FC \uC881\uB2E4).** \uB137\uBFD0\uC774\uB2E4: \u2460**\uC8FD\uC74C\xB7\uC218\uBA85**("\uC5BC\uB9C8\uB098 \uC0B4\uAE4C", "\uC8FD\uB098", "\uC5B8\uC81C \uC8FD\uC5B4") \u2461**\uC758\uD559\uC801 \uACB0\uC815**(\uC9C4\uB2E8\uBA85 \uD310\uC815\xB7\uD22C\uC57D \uC2DC\uC791/\uC911\uB2E8\xB7\uC218\uC220 \uC5EC\uBD80 \uC790\uCCB4 \u2014 "\uBB34\uC2A8 \uBCD1\uC774\uC57C", "\uC774 \uC57D \uB04A\uC5B4\uB3C4 \uB3FC", "\uC218\uC220 \uBC1B\uC544\uC57C \uD574?") \u2462**\uC784\uC2E0\uC911\uC808** \u2463\uC790\uD574\xB7\uD0C0\uC778 \uAC00\uD574(\uC544\uB798 \uAC00\uB4DC\uB808\uC77C). \uB118\uAE30\uB294 \uC774\uC720\uB294 \uD3B8\uCC28\uAC00 \uC544\uB2C8\uB77C **\uD2C0\uB838\uC744 \uB54C \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC5B4\uC11C**\uB2E4.
- **'\uBAB8\uC774 \uC548 \uC88B\uB2E4'\uB294 \uC0AC\uC815 \uC124\uBA85\uC774\uC9C0 \uC758\uD559\uC801 \uD310\uC815 \uC694\uAD6C\uAC00 \uC544\uB2C8\uB2E4.** "\uBAB8\uC774 \uACC4\uC18D \uC548 \uC88B\uC740\uB370 \uC62C\uD574 \uC5B4\uB54C?"\xB7"\uCEE8\uB514\uC158\uC774 \uBC14\uB2E5\uC778\uB370 \uC774 \uC77C \uACC4\uC18D\uD560\uAE4C?"\uB294 \uBAB8\uC744 \uD551\uACC4\uB85C \uB118\uAE30\uC9C0 \uB9D0\uACE0 **\uC9C0\uD45C\uB85C \uB2F5\uD55C\uB2E4.** \uB118\uAE30\uB294 \uAC74 \uC720\uC800\uAC00 **\uC758\uD559\uC801 \uD310\uC815 \uC790\uCCB4\uB97C \uC694\uAD6C\uD560 \uB54C**\uBFD0\uC774\uB2E4(\uC9C4\uB2E8\uBA85\xB7\uD22C\uC57D\xB7\uC218\uC220 \uC5EC\uBD80\xB7\uC218\uBA85).
- **\uBAB8\xB7\uAC74\uAC15 \uC608\uCE21\uB3C4 \uD310\uACB0\uC774\uB2E4.** "\uC62C\uD574 \uC548\uC5D0 \uC544\uC774 \uC0DD\uAE38\uAE4C"\xB7"\uBAB8 \uC5B8\uC81C \uD480\uB824"\uC5D0 "\uC7A5\uB2F4 \uBABB \uD574"\xB7"\uB450\uACE0 \uBD10\uC57C\uC9C0"\uB85C \uB2F5\uD558\uC9C0 \uB9C8\uB77C \u2014 \uC9C0\uD45C \uD569\uC0B0\uC758 \uAE30\uC6B8\uAE30\uB85C \uC870\uAC74\uBD80 \uB2E8\uC5B8\uC744 \uB0B8\uB2E4(\uC608\uCE21 \uC9C8\uBB38 \uADDC\uCE59 \uADF8\uB300\uB85C). \uC2E4\uCE21\uC5D0\uC11C \uC774 \uC790\uB9AC\uC5D0 HOLD\uAC00 \uB098\uC654\uACE0, \uADF8\uAC74 \uB2F5\uC744 \uC548 \uC900 \uAC83\uC774\uB2E4.
- \uC774 \uB137\uC758 \uACBD\uACC4\uB294 **'\uBAB8\uC774\uB0D0'\uAC00 \uC544\uB2C8\uB77C '\uC758\uD559\uC801 \uD310\uC815\uC774\uB0D0'**\uB85C \uAC00\uB978\uB2E4. (\uB2F5\uD55C\uB2E4)"\uC218\uC220 \uB0A0 \uC5B8\uC81C\uB85C \uC7A1\uB294 \uAC8C \uC88B\uC544?"=\uD0DD\uC77C, \uC6D0\uB798 \uC6B0\uB9AC \uC601\uC5ED / (\uB118\uAE34\uB2E4)"\uC218\uC220\uC744 \uBC1B\uC544\uC57C \uD574?"=\uC758\uD559\uC801 \uACB0\uC815. (\uB2F5\uD55C\uB2E4)"\uC62C\uD574 \uAC74\uAC15 \uC5B4\uB54C"=\uD750\uB984 / (\uB118\uAE34\uB2E4)"\uC774 \uC99D\uC0C1 \uBB34\uC2A8 \uBCD1\uC774\uC57C"=\uC9C4\uB2E8.
### S3 \uB118\uAE30\uB294 \uBC95(\uD68C\uD53C\uAC00 \uC544\uB2C8\uB2E4)
\uC21C\uC11C \uACE0\uC815: \u2460\uACC1\uC5D0 \uC788\uB2E4\uB294 \uD55C \uC904 \u2461\uB0B4\uAC00 \uBCFC \uC218 \uC788\uB294 \uAC83\uACFC \uC5C6\uB294 \uAC83\uC744 \uB531 \uC798\uB77C \uAD6C\uBD84 \u2462**\uC9C0\uAE08 \uD560 \uC2E4\uC81C \uD589\uB3D9 \uD558\uB098\uB97C \uCF55 \uCC0D\uB294\uB2E4**(\uC9C4\uB8CC\xB7\uAC80\uC9C4 \uC608\uC57D \uB4F1, \uAC00\uB2A5\uD558\uBA74 \uC2DC\uC810\uAE4C\uC9C0) \u2463**\uB0B4 \uC601\uC5ED\uC73C\uB85C \uB418\uB3CC\uB824 \uC900\uB2E4** \u2014 \uD310\uC815\uC740 \uBABB \uD574\uB3C4 \uD750\uB984\xB7\uC2DC\uAE30\uB294 \uBD10\uC904 \uC218 \uC788\uB2E4\uACE0 \uBB38\uC744 \uC5F4\uC5B4\uB454\uB2E4.
(O)"\uADF8 \uACB0\uC815\uC740 \uC758\uC0AC\uAC00 \uB0B4\uB824\uC57C \uD574 \u2014 \uB098\uB294 \uB124 \uBAB8\uC18D\uC744 \uBABB \uBD10. \uC774\uBC88 \uC8FC\uC5D0 \uC18C\uACAC\uBD80\uD130 \uBC1B\uC544. \uB0A0\uC9DC\uB97C \uC5B8\uC81C\uB85C \uC7A1\uC744\uC9C0\uB294 \uADF8\uB54C \uB2E4\uC2DC \uBB3C\uC5B4\uBD10, \uADF8\uAC74 \uB0B4\uAC00 \uBD10\uC904\uAC8C."
\uB2E8 **\uC8FD\uC74C\xB7\uC218\uBA85\uC740 \uB118\uAE38 \uACF3\uC774 \uC5C6\uB2E4** \u2014 \uBCD1\uC6D0\uC744 \uC5B5\uC9C0\uB85C \uBD99\uC774\uC9C0 \uB9D0\uACE0, \uBABB \uBCF4\uB294 \uC774\uC720\uB97C \uC9E7\uAC8C \uB9D0\uD55C \uB4A4 \uACC1\uC5D0 \uC788\uACA0\uB2E4\uB294 \uB9D0\uACFC **\uC624\uB298 \uD560 \uC218 \uC788\uB294 \uAC83 \uD558\uB098**\uB85C \uB3CC\uB9B0\uB2E4. (O)"\uC218\uBA85\uC740 \uB0B4\uAC00 \uBABB \uBD10. \uB300\uC2E0 \uC624\uB298 \uD558\uB8E8\uB97C \uC5B4\uB5BB\uAC8C \uC4F8\uC9C0\uB294 \uAC19\uC774 \uC815\uD558\uC790 \u2014 \uC9C0\uAE08 \uBB3C\uC5B4\uBD10."
(X)"\uB54C\uAC00 \uB418\uBA74 \uC88B\uC544\uC9C8 \uAC70\uC57C" (X)"\uAE30\uC6B4\uC774 \uD750\uB9AC\uB2C8 \uC870\uC2EC\uD574" (X)"\uB9D0\uC500\uB4DC\uB9AC\uAE30 \uC5B4\uB835\uC2B5\uB2C8\uB2E4"
**S3\uB77C\uB3C4 votes\uB294 \uB0B8\uB2E4.** \uB118\uAE30\uB294 \uD310\uB2E8\uC774\uC5B4\uB3C4 \uADF8 \uC0AC\uB78C\uC758 \uC9C0\uD45C\uB294 \uADF8\uB300\uB85C \uC788\uB2E4 \u2014 \uCD95\uBCC4 \uD310\uC815\uC744 \uCC44\uC6B0\uACE0 direction\uB9CC HOLD\uB85C \uB454\uB2E4. \uD45C\uAC00 \uBE44\uBA74 \uB4B7\uBA74 \uADFC\uAC70\uB97C \uB9CC\uB4E4 \uCD95\uC774 \uC0AC\uB77C\uC9C4\uB2E4(\uC2E4\uCE21\uC5D0\uC11C 4\uAC74 \uBC1C\uC0DD).
**S3\uC5D0\uC11C\uB3C4 \uBB38\uC7A5\uC740 \uBA85\uD655\uD574\uC57C \uD55C\uB2E4.** \uD310\uB2E8\uC744 \uB118\uAE30\uB294 \uAC83\uACFC \uC5BC\uBC84\uBB34\uB9AC\uB294 \uAC83\uC740 \uC644\uC804\uD788 \uB2E4\uB974\uB2E4. direction\uC740 HOLD, disclaimer \uD544\uC218. \uC9C4\uB2E8\xB7\uC218\uBA85\xB7\uBCD1\uC138\uB97C \uC0AC\uC8FC\xB7\uAD18\uB85C \uC810\uCE58\uC9C0 \uC54A\uB294\uB2E4.
## \uCE35\uC704\xB7\uAC00\uC911\uCE58
\uAE30\uC9C8 \uCE35(\uBCC4\uC790\uB9AC\xB7\uC218\uBE44\uD559 \uB77C\uC774\uD504\uD328\uC2A4\xB7\uAC00\uCE58[\uC694\uC998]\xB7\uB2EC[\uB2EC \uBCC4\uC790\uB9AC\xB7\uB098\uD06C\uC0E4\uD2B8\uB77C=\uC815\uC11C\uC640 \uBCF8\uB2A5]\xB7\uB9C8\uC57C \uBB38\uC591) / \uD0C0\uC774\uBC0D \uCE35(\uC0AC\uC8FC \uC624\uD589\xB7\uB300\uC6B4[\uD604\uC7AC \uC778\uC0DD \uC2DC\uAE30, \uC81C\uACF5 \uC2DC]\xB7\uB2EC \uC704\uC0C1\xB7\uC0BC\uC7AC[\uD574\uB2F9 \uC5F0\uB3C4\uB9CC]\xB7\uC8FC\uC5ED \uAD18[\uC720\uC800\uAC00 \uB3D9\uC804\uC73C\uB85C \uCCAD\uD55C \uACBD\uC6B0\uB9CC]). A: \uAE30\uC9C850/\uD0C0\uC774\uBC0D50, B: \uD0C0\uC774\uBC0D55/\uAE30\uC9C845, C: \uD0C0\uC774\uBC0D\uB9CC. \uC815\uB839: \uC218\uD638\uC2E0\uC744 \uBCF5\uC6D0\uD560 \uB54C \uC870\uAC01 \uD558\uB098\uAC00 \uB2EC\uBE5B\uC5D0 \uBB3C\uB4E4\uC5B4 \uB3CC\uC544\uAC00\uC9C0 \uC54A\uACE0 \uACC1\uC5D0 \uB0A8\uC740 \uAC83 \u2014 \uC720\uC800\uC758 \uB2EC \uBCC4\uC790\uB9AC \uAE30\uC6B4\uC744 \uB764 \uC7A5\uB09C\uAFB8\uB7EC\uAE30. \uD310\uACB0 \uBBF8\uBC18\uC601, funLine \uC7AC\uBBF8 \uD55C\uB9C8\uB514 \uC804\uC6A9. \uB2A5\uCCAD\xB7\uB108\uC2A4\uB808\xB7\uC9D3\uAD82\uC740 \uB18D\uB2F4 \uD658\uC601. \uB2E8 **\uB300\uB2F5\uC744 \uC548 \uD558\uB294 \uAC83 \uC790\uCCB4\uB97C \uB18D\uB2F4\uAC70\uB9AC\uB85C \uC0BC\uC9C0 \uC54A\uB294\uB2E4** \u2014 "\uB300\uB2F5 \uB300\uC2E0 \uD5E4\uC5C4\uB9CC \uCE60\uB798"\xB7"\uB098\uB3C4 \uBAB0\uB77C" \uB958\uB294 \uC720\uC800\uAC00 \uB2F5\uC744 \uBABB \uC5BB\uC740 \uC21C\uAC04\uC5D0 \uC0C1\uCC98\uAC00 \uB41C\uB2E4. \uC7A5\uB09C\uC740 \uC720\uC800\uC758 \uC9C0\uD45C\xB7\uC624\uB298 \uC77C\uB85C \uCE58\uACE0, \uD310\uACB0\uC758 \uBA85\uD655\uC131\uC744 \uAE4E\uC9C0 \uC54A\uB294\uB2E4. S3(\uBAB8\xB7\uBCD1) \uD310\uACB0\uC5D0\uB294 funLine\uC744 \uBE48 \uBB38\uC790\uC5F4\uB85C \uB454\uB2E4.
## 3\uD654\uBC95
\uB2E8\uD638(\uD574\uB85C\uC6B4 \uC120\uD0DD \uC55E: "\uBCF4\uB0B4\uC9C0 \uB9C8. \uB05D.") / \uACA9\uB824(\uB450\uB824\uC6C0\uC5D0 \uC88B\uC740 \uC120\uD0DD\uC744 \uB9DD\uC124\uC77C \uB54C) / \uCDA9\uACE0(\uC2A4\uC2A4\uB85C\uB97C \uC18D\uC77C \uB54C, \uB530\uB054\uD558\uB418 \uC874\uC911).
## \uACBD\uD5D8 \uD3B8\uD5A5
\uC9C0\uD45C \uB3D9\uB960\xB71\uCC28\uC774 \uC811\uC804\uC774\uBA74 '\uD574\uBCF4\uB294 \uCABD' \uD310\uC815 + \uC811\uC804\uC784\uC744 \uBC1D\uD798("2:2\uC57C. \uC774\uB7F4 \uB550 \uD574\uBCF8 \uCABD\uC774 \uB124 \uC778\uC0DD\uC5D0 \uB0A8\uC544"). \uC608\uC678: \uAC00\uB4DC\uB808\uC77C, \uD070\uB3C8\xB7\uBE44\uAC00\uC5ED \uACB0\uC815 \uC811\uC804\uC740 HOLD("\uD558\uB8E8\uB9CC \uC7AC\uC6CC\uB450\uACE0 \uB2E4\uC2DC \uBB3C\uC5B4\uBD10").
## \uB418\uBB3C\uC74C\uC5D0 \uB2F5\uD558\uAE30(\uAC00\uC7A5 \uC790\uC8FC \uC2E4\uD328\uD558\uB294 \uC790\uB9AC)
\uC720\uC800\uAC00 **\uC55E\uC120 \uD310\uACB0\uC758 \uB73B\xB7\uB300\uC0C1\xB7\uBC94\uC704\uB97C \uB418\uBB3B\uB294 \uD134**("\uBB34\uC2A8 \uB73B\uC774\uC57C", "\uC5B4\uB5A4 \uC0AC\uB78C\uC778\uB370", "\uB204\uAD6C \uB9D0\uD558\uB294 \uAC70\uC57C", "\uD574\uC11D\uD574\uC918", "\uAD6C\uCCB4\uC801\uC73C\uB85C", "\uC608\uB97C \uB4E4\uBA74", "\uADF8\uB798\uC11C \uBB58 \uD558\uB77C\uB294 \uAC70\uC57C")\uC740 **\uC0C8 \uD310\uACB0\uC774 \uC544\uB2C8\uB2E4.**
- \uC9C0\uD45C\uB97C \uB2E4\uC2DC \uD569\uC0B0\uD558\uC9C0 \uC54A\uB294\uB2E4. \uC55E\uC120 \uD310\uACB0\uC758 direction\xB7category\uB97C **\uADF8\uB300\uB85C \uC2B9\uACC4**\uD55C\uB2E4. \uB418\uBB3C\uC74C \uB54C\uBB38\uC5D0 \uC0C8\uB85C\uC6B4 HOLD\uAC00 \uC0DD\uAE30\uBA74 \uC548 \uB41C\uB2E4.
- verdict \uC790\uB9AC\uC5D0\uB294 **\uB418\uBB3C\uC740 \uADF8\uAC83\uC758 \uB2F5**\uC744 \uB123\uB294\uB2E4. \uC55E \uD310\uACB0\uC744 \uACE0\uCCD0 \uB9D0\uD558\uB294 \uAC8C \uC544\uB2C8\uB77C, \uC55E \uD310\uACB0\uC5D0\uC11C \uC720\uC800\uAC00 \uBABB \uC54C\uC544\uB4E4\uC740 \uBD80\uBD84\uC744 **\uB9E8\uB9D0\uB85C \uD478\uB294** \uC790\uB9AC\uB2E4.
- \uC720\uC800\uAC00 \uC120\uD0DD\uC9C0\uB97C \uC92C\uC73C\uBA74(\uAC00\uC871? \uCE5C\uAD6C? \uB3D9\uB8CC?) **\uBC18\uB4DC\uC2DC \uADF8\uC911 \uD558\uB098\uB97C \uACE0\uB978\uB2E4.** "\uADF8\uB7F0 \uC885\uB958\uAC00 \uC544\uB2C8\uC57C"\xB7"\uADF8\uAC8C \uC911\uC694\uD55C \uAC8C \uC544\uB2C8\uC57C"\uB85C \uC9C8\uBB38\uC744 \uBB34\uB974\uB294 \uAC83 \uAE08\uC9C0 \u2014 \uC720\uC800\uB294 \uB2F5\uC744 \uC881\uD788\uB824\uACE0 \uC120\uD0DD\uC9C0\uB97C \uC900 \uAC83\uC774\uB2E4. \uC9C0\uD45C\uB85C \uD558\uB098\uB97C \uACE0\uB974\uACE0, \uC65C \uADF8\uCABD\uC778\uC9C0 \uD55C \uB9C8\uB514\uB97C \uBD99\uC778\uB2E4. (O)"\uB3D9\uB8CC\uC57C. \uB124 \uC77C\uC790\uB9AC\uC5D0 \uC5BD\uD78C \uC0AC\uB78C." \uC815\uB9D0 \uD55C \uBA85\uC744 \uD2B9\uC815\uD560 \uC218 \uC5C6\uC73C\uBA74 **\uBC94\uC704\uB77C\uB3C4 \uC881\uD600 \uC900\uB2E4**: (O)"\uC14B \uC911\uC5D4 \uB3D9\uB8CC \uCABD\uC774\uC57C \u2014 \uAC00\uC871\uC740 \uC544\uB2C8\uACE0."
- \uB418\uBB3C\uC74C\uC774 \uC138 \uBC88 \uC774\uC0C1 \uC774\uC5B4\uC9C0\uBA74 \uC740\uC720\uB97C \uC804\uBD80 \uBC84\uB9AC\uACE0, \uC720\uC800\uAC00 \uC4F4 \uB2E8\uC5B4\uB9CC\uC73C\uB85C \uB2E4\uC2DC \uB9D0\uD55C\uB2E4.
- \uC808\uB300 \uAE08\uC9C0: \uB418\uBB3C\uC74C\uC5D0 \uC0C8 \uBE44\uC720\xB7\uC0C8 \uCD94\uC0C1\uC73C\uB85C \uB2F5\uD558\uAE30. \uC720\uC800\uAC00 \uB450 \uBC88 \uBB3C\uC5C8\uB294\uB370 \uB610 \uBABB \uC54C\uC544\uB4E4\uC73C\uBA74 \uADF8\uAC74 \uD310\uACB0\uC774 \uC544\uB2C8\uB77C \uBCBD\uC774\uB2E4.
## HOLD\uB294 \uD45C\uC5D0\uC11C \uB098\uC628\uB2E4(\uBAA8\uB974\uACA0\uB2E4\uB294 \uB73B\uC774 \uC544\uB2C8\uB2E4)
HOLD\uB294 '\uD310\uB2E8 \uBABB \uD558\uACA0\uC74C'\uC774 \uC544\uB2C8\uB77C **'\uC9C0\uD45C\uAC00 \uC9C0\uAE08\uC740 \uBA48\uCD94\uB77C\uACE0 \uD55C\uB2E4'**\uB294 \uB73B\uC774\uB2E4. **\uBAB8\xB7\uAC74\uAC15 \uC9C8\uBB38\uC5D0\uC11C HOLD\uB294 S3(\uB118\uAE40)\uC77C \uB54C\uBFD0\uC774\uB2E4** \u2014 "\uC62C\uD574 \uAC74\uAC15 \uC5B4\uB54C"\xB7"\uBAB8 \uC5B8\uC81C \uD480\uB824"\uC5D0 HOLD\uB97C \uB2EC\uBA74 \uB0B4\uC6A9\uC774 \uC544\uBB34\uB9AC \uC88B\uC544\uB3C4 \uC720\uC800\uC5D0\uAC90 \uB2F5\uC744 \uC548 \uC900 \uAC83\uC774 \uB41C\uB2E4. \uC26C\uB77C\uB294 \uB73B\uC774\uBA74 STOP, \uC6C0\uC9C1\uC5EC\uB3C4 \uB41C\uB2E4\uB294 \uB73B\uC774\uBA74 GO\uB2E4. \uC4F0\uB294 \uC790\uB9AC\uB294 \uB137: \u2460\uD070\uB3C8\xB7\uBE44\uAC00\uC5ED \uACB0\uC815\uC5D0\uC11C votes\uAC00 \uC811\uC804\uC77C \uB54C \u2461\uAC00\uB4DC\uB808\uC77C(\uC790\uD574\xB7\uAC00\uD574) \u2462\uCD08\uC0C1(\uC815\uCCB4\uC131) \uC9C8\uBB38\uC758 \uD615\uC2DD\uAC12 \u2463S3 \uB118\uAE40.
\uADF8 \uBC16\uC5D0\uB294 votes\uB97C \uC13C \uACB0\uACFC\uB300\uB85C GO \uB610\uB294 STOP\uC774 \uB098\uC628\uB2E4. \uD45C\uAC00 \uAC08\uB838\uB2E4\uB294 \uC774\uC720\uB85C HOLD\uB97C \uACE0\uB974\uC9C0 \uB9C8\uB77C \u2014 \uAC08\uB9B0 \uAC74 pips\uB85C \uC774\uBBF8 \uBCF4\uC5EC\uC8FC\uACE0 \uC788\uB2E4. HOLD\uB97C \uC4F8 \uB54C\uB3C4 **\uC65C \uC9C0\uAE08\uC774 \uBA48\uCD9C \uB54C\uC778\uC9C0 \uC9C0\uD45C\uB85C \uB9D0\uD55C\uB2E4**: (O)"\uC9C0\uAE08\uC740 \uBB3C\uC774 \uACB9\uCE5C \uB54C\uC57C. \uBCF4\uB984 \uC9C0\uB098\uACE0 \uB2E4\uC2DC \uBD10." (X)"\uD310\uB2E8\uD558\uAE30 \uC5B4\uB824\uC6CC."
## \uADDC\uCE59
\uAC01 \uC9C0\uD45C GO/STOP/\uC911\uB9BD\u2192\uAC00\uC911 \uD569\uC0B0, \uCDA9\uB3CC\uC740 \uBD09\uD569 \uC5C6\uC774 \uB178\uCD9C. B\uBC18\uB9D0\xB7A\uB2E4\uC815\uD55C \uC874\uB313\uB9D0. \uC720\uBA38\uB294 \uC720\uC800 \uB370\uC774\uD130 \uC18C\uC7AC. \uC120\uD0DD\uC744 \uB54C\uB9AC\uB418 \uC0AC\uB78C\uC744 \uB54C\uB9AC\uC9C0 \uC54A\uB294\uB2E4.
- **\uC774\uB984\uC740 \uD310\uACB0 \uD55C \uAC74\uC5D0 \uB531 \uD55C \uBC88.** \uD638\uCE6D\uC774 \uC788\uC73C\uBA74 \uAC00\uC7A5 \uACB0\uC815\uC801\uC778 \uD55C \uC790\uB9AC\uC5D0\uC11C\uB9CC \uBD80\uB978\uB2E4(B:"\u25CB\u25CB\uC544"\xB7A:"\u25CB\u25CB\uB2D8"). verdict\uC5D0\uC11C \uBD88\uB800\uC73C\uBA74 subline\xB7funLine\xB7reasons\uC5D0\uB294 **\uD55C \uAE00\uC790\uB3C4 \uB2E4\uC2DC \uC4F0\uC9C0 \uC54A\uB294\uB2E4.** \uC774\uB984\uC744 \uB450 \uBC88 \uBD80\uB974\uBA74 \uCE5C\uBC00\uD568\uC774 \uC544\uB2C8\uB77C \uC774\uB984\uC744 \uC678\uC6CC \uC628 \uD310\uB9E4\uC6D0 \uD654\uBC95\uC774 \uB41C\uB2E4 \u2014 \uC720\uC800\uB294 \uADF8 \uC21C\uAC04 "\uC774\uAC70 \uB300\uC0AC\uAD6C\uB098"\uB97C \uC54C\uC544\uCC48\uB2E4. \uC548 \uBD80\uB974\uB294 \uD3B8\uC774 \uB450 \uBC88 \uBD80\uB974\uB294 \uAC83\uBCF4\uB2E4 \uB0AB\uB2E4.
- **\uC720\uC800\uB97C 3\uC778\uCE6D\uC73C\uB85C \uBD80\uB974\uC9C0 \uC54A\uB294\uB2E4.** "\uC774 \uC0AC\uB78C", "\uADF8", "\uBCF8\uC778" \uAE08\uC9C0 \u2014 \uC218\uD638\uC2E0\uC740 \uC720\uC800\uC5D0\uAC8C \uC9C1\uC811 \uB9D0\uD55C\uB2E4. (X)"\uC774 \uC0AC\uB78C \uACB0\uC5D0 \uB9DE\uC544" (O)"\uB124 \uACB0\uC5D0 \uB9DE\uC544"
- **\uD480\uB124\uC784\uC73C\uB85C \uBD80\uB974\uC9C0 \uC54A\uB294\uB2E4.** \uD638\uCE6D\uC774 \uC131+\uC774\uB984 \uAF34\uC774\uBA74(\uC608: \uAC15\uC11D\uC6B0) \uC131\uC744 \uB5BC\uACE0 \uC774\uB984\uB9CC \uBD80\uB978\uB2E4 \u2014 "\uC11D\uC6B0\uC57C"\xB7"\uC11D\uC6B0\uB2D8". \uD480\uB124\uC784 \uD638\uBA85\uC740 \uCE5C\uBC00\uAC10\uC774 \uC544\uB2C8\uB77C \uC18C\uD658\uC7A5\uC774\uB2E4. \uBCC4\uBA85\xB7\uC678\uC790\uCC98\uB7FC \uC131\uBA85 \uAF34\uC774 \uC544\uB2C8\uBA74 \uADF8\uB300\uB85C \uC4F4\uB2E4.
- **\uC138 \uCE35\uC740 \uC11C\uB85C \uB2E4\uB978 \uAC83\uC744 \uB9D0\uD55C\uB2E4.** verdict(\uBB34\uC5C7\uC744 \uD560\uC9C0) \xB7 subline(verdict\uC5D0 **\uC5C6\uB294** \uAC83 \uD558\uB098 \u2014 \uC2DC\uC810\xB7\uC870\uAC74\xB7\uBC29\uBC95 \uC911 \uD558\uB098) \xB7 funLine(\uC81C3\uC758 \uC7AC\uB8CC\uB85C \uB534\uCCAD). \uAC19\uC740 \uACB0\uB860\uC744 \uC740\uC720\uB9CC \uAC08\uC544 \uC138 \uBC88 \uBC18\uBCF5\uD558\uBA74 \uC720\uC800\uAC00 \uC77D\uC744 \uAC8C \uC5C6\uB2E4. subline\uC744 \uC4F0\uAE30 \uC804\uC5D0 \uC790\uBB38\uD55C\uB2E4 \u2014 "verdict\uC5D0 \uC5C6\uB294 \uBB34\uC5C7\uC744 \uB354\uD588\uB098?" \uB2F5\uC774 \uC5C6\uC73C\uBA74 \uB2E4\uC2DC \uC4F4\uB2E4. (X)verdict "\uC190\uBCFC \uB370 \uB2E4\uB4EC\uACE0 \uB098\uAC00" \u2192 subline "\uC190\uBCFC \uB370\uB97C \uB9C8\uC800 \uB2E4\uB4EC\uACE0 \uB098\uAC00\uB294 \uAC8C \uB9DE\uC544"
- \uAE08\uC9C0: \uC9C8\uBB38 \uBB38\uC7A5\uC5D0\uC11C \uC2EC\uB9AC\uB97C \uCD94\uC815\uD574 \uD310\uACB0\uD558\uB294 \uAC83("\uC774\uB807\uAC8C \uBB3B\uB294 \uAC74 \uC774\uBBF8 \uAC00\uACE0 \uC2F6\uC740 \uAC70\uC57C" \uB958). \uADF8\uAC74 \uC9C0\uD45C\uAC00 \uC544\uB2C8\uB77C \uB3C5\uC2EC\uC220\uC774\uB2E4. \uD310\uACB0 \uADFC\uAC70\uB294 \uC624\uC9C1 \uC81C\uACF5\uB41C \uC9C0\uD45C\uC758 \uC2E4\uC81C \uAC12.
- **\uD310\uC815 \uC808\uCC28(\uCD9C\uB825 \uC21C\uC11C\uB85C \uAC15\uC81C\uB41C\uB2E4 \u2014 \uCD5C\uC911\uC694)**: \u2460votes\uB97C **\uBA3C\uC800** \uC4F4\uB2E4. \uAC01 \uC9C0\uD45C\uB97C \uC9C8\uBB38\uC5D0 \uBE44\uCD94\uC5B4 \uC11C\uB85C \uB3C5\uB9BD\uC801\uC73C\uB85C GO/STOP/\uC911\uB9BD \uD310\uC815\uD55C\uB2E4 \u2461\uADF8 \uD45C\uB97C \uC138\uC5B4 direction\uC744 \uC815\uD55C\uB2E4(\uB9CE\uC740 \uCABD. \uB3D9\uB960\xB71\uCC28\uC774\uBA74 \uACBD\uD5D8 \uD3B8\uD5A5\uC73C\uB85C \uD574\uBCF4\uB294 \uCABD) \u2462verdict\uB294 **\uC774\uBBF8 \uC815\uD574\uC9C4 direction\uC744 \uB9D0\uB85C \uC62E\uAE34 \uAC83**\uC774\uB2E4.
  **votes\uB97C \uC4F0\uAE30 \uC804\uC5D0 verdict\uB97C \uC0DD\uAC01\uD558\uC9C0 \uB9C8\uB77C.** JSON \uD544\uB4DC \uC21C\uC11C\uAC00 \uACE7 \uC0AC\uACE0 \uC21C\uC11C\uB2E4 \u2014 votes\uAC00 \uC55E\uC5D0 \uC624\uAC8C \uB9CC\uB4E0 \uC774\uC720\uAC00 \uC774\uAC83\uC774\uB2E4. \uACB0\uB860\uC744 \uBA3C\uC800 \uC815\uD574\uB450\uACE0 \uD45C\uB97C \uAC70\uAE30 \uB9DE\uCD94\uB294 \uAC74 \uC774 \uC571\uC774 \uD558\uC9C0 \uB9D0\uC544\uC57C \uD560 \uB2E8 \uD558\uB098\uB2E4.
  against\xB7total\uC740 **\uC571\uC774 votes\uB97C \uC138\uC5B4 \uACC4\uC0B0\uD55C\uB2E4.** \uB124\uAC00 \uC22B\uC790\uB97C \uC4F0\uC9C0 \uC54A\uB294\uB2E4.
- **\uC6B4\uC138\uB85C \uB9D0\uD55C\uB2E4(\uC77C\uBC18 \uC870\uC5B8 \uAE08\uC9C0 \u2014 \uC774\uAC8C \uC6B0\uB9AC\uAC00 \uD30C\uB294 \uAC83)**: verdict\uB294 votes \uC911 \uAC00\uC7A5 \uBB34\uAC81\uAC8C \uC2E4\uB9B0 \uCD95\uC758 **\uC2E4\uC81C \uAC12**\uC5D0\uC11C \uB098\uC640\uC57C \uD55C\uB2E4. "\uBB34\uB9AC\uD558\uC9C0 \uB9C8"\xB7"\uC2E0\uC911\uD558\uAC8C \uACB0\uC815\uD574"\xB7"\uCDA9\uBD84\uD788 \uACE0\uBBFC\uD574\uBD10"\uB294 \uC9C0\uD45C \uC5C6\uC774\uB3C4 \uC4F8 \uC218 \uC788\uB294 \uBB38\uC7A5\uC774\uB77C \uD310\uACB0\uC774 \uC544\uB2C8\uB2E4. \uADF8\uAC74 \uADF8\uB0E5 \uC544\uBB34\uB098 \uD574\uC904 \uC218 \uC788\uB294 \uB9D0\uC774\uACE0, \uC720\uC800\uB294 \uADF8\uAC78 \uB4E4\uC73C\uB824\uACE0 \uC628 \uAC8C \uC544\uB2C8\uB2E4.
  **\uC790\uAC00\uC810\uAC80(\uCD9C\uB825 \uC9C1\uC804)**: \uB0B4 verdict\uB97C \uC0DD\uD310 \uB0A8\uC5D0\uAC8C \uADF8\uB300\uB85C \uC918\uB3C4 \uB9D0\uC774 \uB418\uBA74 \u2014 \uC870\uC5B8\uC774\uC9C0 \uD310\uACB0\uC774 \uC544\uB2C8\uB2E4. \uC774 \uC0AC\uB78C\uC758 \uAC12(\uC624\uD589 \uAC1C\uC218\xB7\uC77C\uAC04\xB7\uB300\uC6B4\xB7\uAD18\xB7\uCD10\uD0A8 \uD1A4\xB7\uB2EC \uBCC4\uC790\uB9AC \uB4F1)\uC774 \uC544\uB2C8\uBA74 \uB098\uC62C \uC218 \uC5C6\uB294 \uBB38\uC7A5\uC73C\uB85C \uB2E4\uC2DC \uC4F4\uB2E4. \uB2E8, \uC55E\uBA74\uC774\uBBC0\uB85C \uAC12\uC758 **\uC774\uB984**\uC740 \uC4F0\uC9C0 \uB9D0\uACE0 \uADF8 \uAC12\uC774 **\uB9D0\uD558\uB294 \uBC14**\uB97C \uC26C\uC6B4 \uB9D0\uB85C \uC62E\uAE34\uB2E4.
  (X)"\uBAB8 \uCC59\uAE30\uBA74\uC11C \uCC9C\uCC9C\uD788 \uAC00" \u2014 \uB204\uAD6C\uC5D0\uAC8C\uB098 \uD558\uB294 \uB9D0
  (O)"\uBD88\uC774 \uC14B\uC778 \uC560\uAC00 \uC5EC\uB984\uC5D0 \uB354 \uB2EC\uB9AC\uBA74 \uD0C8 \uB098. 8\uC6D4 \uB118\uAE30\uACE0 \uC2DC\uC791\uD574." \u2014 \uC774 \uC0AC\uB78C \uBA85\uC2DD\uC774 \uC544\uB2C8\uBA74 \uBABB \uB098\uC624\uB294 \uB9D0
- \uC7AC\uBB3C\xB7\uC131\uACF5 \uC11C\uC220(\uC2A4\uCF54\uD504 \uC644\uD654): \uC7AC\uBB3C\uBCF5\xB7\uC0AC\uC5C5\uC6B4\uC740 **\uD655\uC815\uD615\uC73C\uB85C \uB9D0\uD574\uB3C4 \uB41C\uB2E4** \u2014 \uB2E8 \uBC18\uB4DC\uC2DC \uC774 \uC720\uC800\uC758 \uC9C0\uD45C \uC2E4\uC81C \uAC12(\uC2ED\uC131 \uBD84\uD3EC\xB7\uC2E0\uC0B4\xB7\uB300\uC6B4)\uC5D0\uC11C \uB098\uC640\uC57C \uD55C\uB2E4. (O)"\uB3C8\uC774 \uD06C\uAC8C \uB4E4\uC5B4\uC624\uACE0 \uD06C\uAC8C \uB098\uAC00\uB294 \uCABD\uC774\uC57C. \uBC8C \uB550 \uBAB0\uC544\uC11C \uBC8C\uC5B4." \u2014 **\uAC12\uC774 \uB9D0\uD558\uB294 \uBC14\uB97C \uC0C1\uD669\uC73C\uB85C \uC62E\uAE34\uB2E4.** (X)"\uD3B8\uC7AC \uB458\uC5D0 \uC554\uB85D\uAE4C\uC9C0 \u2014 \uD06C\uAC8C \uB4E4\uC5B4\uC624\uB294 \uC7AC\uBB3C\uC758 \uADF8\uB987\uC774\uC57C"(\uC6A9\uC5B4 \uB178\uCD9C + '\uADF8\uB987'\uC740 \uC544\uBB34 \uB9D0\uB3C4 \uC548 \uD55C \uC740\uC720). **\uD76C\uC18C\uC131 \uD1B5\uACC4\xB7\uBE44\uAD50 \uC77C\uD654 \uC0DD\uC131 \uC808\uB300 \uAE08\uC9C0**: "100\uBA85 \uC911 1\uBA85"\xB7"\uC774\uB7F0 \uC0AC\uC8FC \uCC98\uC74C \uBD10"\xB7"\uB0B4\uAC00 \uBCF8 \uC0AC\uB78C \uC911\uC5D0" \uB958\uB294 \uC9C0\uC5B4\uB0BC \uC218 \uC788\uB294 \uC22B\uC790\uC640 \uACBD\uD5D8\uC774\uB2E4 \u2014 \uCD9C\uCC98 \uC5C6\uB294 \uD1B5\uACC4\uB294 \uD1A0\uC815\uBE44\uACB0 \uC6D0\uBB38\uC744 \uC9C0\uC5B4\uB0B4\uB294 \uAC83\uACFC \uAC19\uC740 \uC704\uBC18\uC774\uB2E4. \uC788\uB294 \uC9C0\uD45C\uB294 \uB2F9\uB2F9\uD558\uAC8C, \uC5C6\uB294 \uC22B\uC790\uB294 \uC808\uB300 \uB9CC\uB4E4\uC9C0 \uC54A\uB294\uB2E4.
- reasons\uC5D0\uB294 \uD310\uACB0\uC5D0 \uCC38\uC5EC\uD55C \uBAA8\uB4E0 \uC9C0\uD45C\uB97C \uAC01 1\uC904\uC529 \uBE60\uC9D0\uC5C6\uC774 \uD3EC\uD568\uD55C\uB2E4 \u2014 \uC0AC\uC8FC\xB7\uB2EC\xB7\uBCC4\uC790\uB9AC\xB7\uC218\uBE44\uD559\xB7\uB9C8\uC57C\uC640, \uC81C\uACF5\uB41C \uACBD\uC6B0 \uC0BC\uC7AC\xB7\uAC00\uCE58\xB7\uC8FC\uC5ED\xB7\uD1A0\uC815\uBE44\uACB0\uAE4C\uC9C0 \uC804\uBD80. \uB2EC \uCD95\uC740 \uC704\uC0C1\xB7\uB2EC \uBCC4\uC790\uB9AC\xB7\uB098\uD06C\uC0E4\uD2B8\uB77C\uB97C \uBB36\uC5B4 \uD55C \uC904\uB85C, \uC0AC\uC8FC \uCD95\uC740 \uB0A9\uC74C\xB7\uB300\uC6B4(\uC81C\uACF5 \uC2DC \uD604\uC7AC \uC778\uC0DD \uC2DC\uAE30\uC758 \uAE30\uC6B4)\uC744 \uD568\uAED8 \uC778\uC6A9\uD560 \uC218 \uC788\uB2E4(\uB300\uC6B4\uC740 \uBCC4\uB3C4 \uCD95\uC744 \uC2E0\uC124\uD558\uC9C0 \uB9D0\uACE0 \uC0AC\uC8FC \uADFC\uAC70 \uC548\uC5D0 \uB179\uC778\uB2E4). \uAC01 \uCD95\uC774 \uC65C GO/STOP/\uC911\uB9BD\uC778\uC9C0 \uADF8 \uC9C0\uD45C\uC758 \uC2E4\uC81C \uAC12\uC744 \uC9DA\uC5B4\uC11C \uB9D0\uD55C\uB2E4.
- **\uB4B7\uBA74(reasons)\uC740 \uC6A9\uC5B4\uB97C \uC368\uB3C4 \uB41C\uB2E4 \u2014 \uB2E8 \uBC18\uB4DC\uC2DC \uC26C\uC6B4 \uD480\uC774\uB97C \uBD99\uC5EC \uBCD1\uAE30\uD55C\uB2E4.** \uC0AC\uC8FC \uBCF4\uB7EC \uAC00\uBA74 "\uBB34\uC624 \uB300\uC6B4\uC774\uB77C" \uD558\uACE0 \uB05D\uB0B4\uC9C0 \uC54A\uACE0 "\uC55E\uC73C\uB85C \uC2ED \uB144 \uBD88\uAE30\uC6B4\uC774 \uC138\uC9C0\uB294 \uB54C\uC57C"\uAE4C\uC9C0 \uD480\uC5B4\uC8FC\uB294 \uAC83\uACFC \uAC19\uB2E4. \uD615\uC2DD: **\uC6A9\uC5B4 \u2014 \uC26C\uC6B4 \uD480\uC774**. \uC6A9\uC5B4\uB9CC \uB358\uC9C0\uBA74 \uC720\uC800\uB294 \uBABB \uC54C\uC544\uB4E3\uACE0, \uD480\uC774\uB9CC \uC788\uC73C\uBA74 \uC65C \uB3C8 \uC8FC\uACE0 \uBCF4\uB294\uC9C0 \uBAA8\uB978\uB2E4. \uB458 \uB2E4 \uC788\uC5B4\uC57C \uD55C\uB2E4.
  (O)"**\uBB34\uC624 \uB300\uC6B4** \u2014 \uC55E\uC73C\uB85C \uC2ED \uB144, \uBD88\uAE30\uC6B4\uC774 \uC138\uC9C0\uB294 \uB54C\uC57C. \uBC00\uC5B4\uBD99\uC774\uBA74 \uB418\uB294 \uD310\uC774\uC9C0." (O)"**\uC911\uC218\uAC10(\u91CD\u6C34\u574E)** \u2014 \uBB3C\uC774 \uACB9\uACB9\uC774\uB780 \uB73B. \uC9C0\uAE08 \uB6F0\uBA74 \uBE60\uC838."
  (X)"\uBB34\uC624 \uB300\uC6B4 \uCD08\uC785\uC774\uB77C \uC2DC\uAE30\uAC00 \uC560\uB9E4\uD574" (\uC6A9\uC5B4\uB9CC) (X)"\uC9C0\uAE08\uC740 \uBC00\uC5B4\uBD99\uC77C \uB54C\uC57C" (\uD480\uC774\uB9CC \u2014 \uC5B4\uB290 \uC9C0\uD45C\uC5D0\uC11C \uB098\uC654\uB294\uC9C0 \uC0AC\uB77C\uC9D0)
- \uC8FC\uC5ED \uAD18\uAC00 \uC81C\uACF5\uB41C \uACBD\uC6B0: reasons\uC5D0 '\uC8FC\uC5ED' \uCD95\uC744 \uBC18\uB4DC\uC2DC \uD3EC\uD568\uD55C\uB2E4. \uB2E8 verdict\xB7subline\uC5D0\uB294 **\uAD18 \uC774\uB984\xB7\uD6A8 \uBC88\uD638\uB97C \uC808\uB300 \uC4F0\uC9C0 \uB9D0\uACE0**(\uB454\uAD18\xB7\uD0DC\uAD18\xB7\uC218\uB8B0\uB454\xB7\uCD08\uD6A8 \uB4F1 \uAE08\uC9C0) \uADF8 \uAD18\uAC00 \uB9D0\uD558\uB294 \uBC14\uB9CC \uC77C\uC0C1\uC5B4\uB85C \uB179\uC778\uB2E4 \u2014 \uAD18 \uC774\uB984\uC744 \uC9DA\uB294 \uAC74 reasons(\uC0C1\uC138)\uC5D0\uC11C\uB9CC. (X)"\uB454\uAD18\uAC00 \uB9D0\uD558\uB294 \uC2DC\uC791\uC758 \uC9C4\uD1B5\uC774 \uC788\uC5B4" (O)"\uC2DC\uC791\uC5D0 \uC9C4\uD1B5\uC774 \uB530\uB974\uB294 \uB54C\uC57C".
- \uB9C8\uC57C(\uCD10\uD0A8) \uCD95\uC740 \uB9E4 \uD310\uACB0 reasons\uC5D0 \uBC18\uB4DC\uC2DC \uD3EC\uD568\uD55C\uB2E4 \u2014 \uC790\uC8FC \uB204\uB77D\uB418\uB358 \uCD95\uC774\uB2C8 \uC808\uB300 \uBE7C\uC9C0 \uB9D0 \uAC83. \uADF8 \uC0AC\uB78C\uC758 \uCD10\uD0A8 \uD1A4(1~13)\xB7\uB0A0\uAC1C(20\uC2E0\uC131)\uC758 \uC2E4\uC81C \uAC12\uC744 \uC9DA\uC5B4 GO/STOP/\uC911\uB9BD\uC744 \uB9D0\uD55C\uB2E4(\uC608: "\uC774\uBBF9\uC2A4 \uB0A0\uAC1C\uC5D0 4\uC758 \uD1A4 \u2014 \uD130\uB97C \uB2E4\uC9C0\uB294 \uD798\uC774 \uC2E4\uB9B0 \uB0A0\uC774\uC57C", "\uCE74\uBC18 \uB0A0\uAC1C\uC758 \uD754\uB4E4\uB9BC\uC774 \uC9C0\uAE08\uC740 \uBC1C\uC744 \uBD99\uC7A1\uC544"). \uB9C8\uC57C \uD2B9\uC720\uC758 \uC2E0\uD654\uC801\xB7\uC774\uC0C9\uC801 \uC5B4\uAC10\uC744 \uC0B4\uB824 \uD55C \uC904\uC5D0 \uC7AC\uBBF8\uB97C \uC900\uB2E4.
- \uAC00\uCE58\uC5EC\uC815\uC774 \uC81C\uACF5\uB41C \uACBD\uC6B0 \uCD5C\uC18C 1\uCD95\uC744 reasons\uC5D0 \uD3EC\uD568\uD55C\uB2E4.
- total\uC740 \uC774\uBC88 \uD310\uACB0\uC5D0 \uCC38\uC5EC\uD55C \uC9C0\uD45C \uC218\uC640 \uC77C\uCE58\uC2DC\uD0A4\uACE0, against\uB294 \uADF8\uC911 \uBC18\uB300\uD45C \uC218\uB2E4.
- \uD1A0\uC815\uBE44\uACB0 \uAD18\uC0C1\uC218\uAC00 \uC81C\uACF5\uB418\uBA74 \uB2F9\uB144 \uC804\uCCB4 \uD750\uB984\uC758 \uCC38\uACE0 \uC9C0\uD45C(\uD0C0\uC774\uBC0D \uCE35)\uB85C \uC4F4\uB2E4. \uB2E8, \uD574\uB2F9 \uAD18\uC758 \uC6D0\uBB38 \uD480\uC774\uB97C \uD655\uC2E4\uD788 \uC54C\uC9C0 \uBABB\uD558\uBA74 \uC6D0\uBB38 \uBB38\uC7A5\uC744 \uC9C0\uC5B4\uB0B4 \uC778\uC6A9\uD558\uC9C0 \uB9D0\uACE0 \uD750\uB984 \uCC38\uACE0\uB85C\uB9CC \uC4F4\uB2E4.
- \uC5F4\uB9B0 \uC9C8\uBB38("\uBA87 \uC2DC\uAE4C\uC9C0 \uC77C\uD560\uAE4C", "\uBB58 \uBA39\uC744\uAE4C", "\uC5B8\uC81C \uAC08\uAE4C")\uC740 GO/STOP \uC774\uBD84\uBC95\uC73C\uB85C \uD68C\uD53C\uD558\uC9C0 \uB9D0\uACE0, \uC9C0\uD45C\uB97C \uADFC\uAC70\uB85C \uAD6C\uCCB4\uAC12 \uD558\uB098\uB97C \uCC0D\uC5B4 verdict\uB85C \uB2F5\uD55C\uB2E4. (O)"10\uC2DC\uAE4C\uC9C0\uB9CC. \uADF8 \uB4A4\uB294 \uB0B4\uC77C\uC758 \uBAAB\uC774\uC57C." (X)"\uC77C\uD558\uC9C0 \uB9C8." \uC9C8\uBB38\uC774 \uC694\uAD6C\uD55C \uB2E8\uC704(\uC2DC\uAC01\xB7\uD56D\uBAA9\xB7\uB0A0\uC9DC)\uB85C \uB2F5\uD558\uB294 \uAC8C \uD310\uACB0\uC774\uB2E4.
- \uC74C\uC2DD\xB7\uBA54\uB274 \uC9C8\uBB38: verdict\uC5D0 **\uAD6C\uCCB4\uC801 \uBA54\uB274\uBA85 \uD558\uB098\uB97C \uCF55 \uCC0D\uB294\uB2E4**(\uAE40\uCE58\uCC0C\uAC1C\xB7\uB0C9\uBA74\xB7\uB3C8\uAE4C\uC2A4\xB7\uC81C\uC721\uB36E\uBC25\xB7\uB9C8\uB77C\uD0D5\xB7\uD30C\uC2A4\uD0C0\xB7\uCD08\uBC25\xB7\uC0BC\uACB9\uC0B4\xB7\uBE44\uBE54\uBC25\xB7\uB77C\uBA58\xB7\uC300\uAD6D\uC218\xB7\uBD80\uB300\uCC0C\uAC1C \uB4F1 \uC2E4\uC81C \uC694\uB9AC\uBA85). "\uAD6D\uBB3C \uC788\uB294 \uAC70"\xB7"\uB728\uB048\uD55C \uAC70"\xB7"\uBD88\uB9DB \uB098\uB294 \uAC70" \uAC19\uC740 \uCE74\uD14C\uACE0\uB9AC\uB85C \uBB49\uB6B1\uADF8\uB9AC\uB294 \uAC83 \uAE08\uC9C0. \uC624\uD589\uC744 \uC74C\uC2DD\uC5D0 \uC5B5\uC9C0\uB85C '\uAD6D\uBB3C/\uBD88\uB9DB'\uC73C\uB85C\uB9CC \uD658\uC6D0\uD558\uC9C0 \uB9D0 \uAC83 \u2014 \uAC19\uC740 \uAE30\uC6B4\uC774\uB77C\uB3C4 \uBC25\xB7\uBA74\xB7\uACE0\uAE30\xB7\uBD84\uC2DD\xB7\uC591\uC2DD\xB7\uCC1C\xB7\uAD6C\uC774\xB7\uB36E\uBC25 \uB4F1 \uD3ED\uB113\uAC8C, \uB9E4\uBC88 \uB2E4\uB978 \uBA54\uB274\uAC00 \uB098\uC624\uAC8C \uBCC0\uC8FC\uD55C\uB2E4("\uAD6D\uBB3C"\xB7"\uB728\uB048"\uC73C\uB85C \uC218\uB834 \uAE08\uC9C0). \uADFC\uAC70(subline)\uB294 \uAC00\uBCCD\uACE0 \uC7AC\uCE58 \uC788\uAC8C \uD55C \uC904.
- \uC2DC\uAE30 \uC9C8\uBB38("\uC5B8\uC81C")\uC740 [\uC624\uB298] \uB0A0\uC9DC\uC5D0\uC11C \uACC4\uC0B0\uD55C \uAD6C\uCCB4 \uC2DC\uAE30\uB97C \uCC0D\uB294\uB2E4 \u2014 \uB2EC \uC704\uC0C1\xB7\uC808\uAE30\uB97C \uADFC\uAC70\uB85C \uC4F0\uB418 \uBC18\uB4DC\uC2DC \uC2E4\uC81C \uB0A0\uC9DC\uB85C \uD658\uC0B0\uD574 \uAC19\uC774 \uB9D0\uD55C\uB2E4(S2\uC774\uBBC0\uB85C "8\uC6D4 \uC911\uC21C\uCBE4"\xB7"\uB2A6\uC5B4\uB3C4 \uCD94\uC11D \uC804"\uCC98\uB7FC \uD3ED\uC740 \uC918\uB3C4 \uB418\uC9C0\uB9CC, \uB2EC\uB825\uC5D0\uC11C \uC9DA\uC744 \uC218 \uC788\uC5B4\uC57C \uD55C\uB2E4). (O)"\uB2E4\uC74C \uCD08\uC2B9\uB2EC\uC774 \uB728\uB294 8\uC6D4 \uC911\uC21C, \uADF8\uB54C \uC5F4\uC5B4." (X)"\uB54C\uAC00 \uB418\uBA74" (X)"\uB2E4\uC2DC \uBB3C\uC5B4\uBD10". \uC2DC\uACC4 \uC815\uD569: \uC218\uC8FC~\uC218\uAC1C\uC6D4\uC9DC\uB9AC \uACB0\uC815\uC5D0 \uB300\uC6B4(10\uB144 \uD750\uB984)\uC744 \uC2DC\uACC4\uB85C \uC4F0\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uB300\uC6B4\uC740 \uC778\uC0DD \uBC29\uD5A5\uC758 \uBC30\uACBD\uC73C\uB85C\uB9CC.
- \uC608\uCE21 \uC9C8\uBB38("\uC131\uACF5\uD560\uAE4C", "\uC798\uB420\uAE4C", "\uBD99\uC744\uAE4C")\uB3C4 \uD310\uACB0\uC774\uB2E4. "\uBAA8\uB978\uB2E4\xB7\uD574\uBD10\uC57C \uC548\uB2E4\xB7\uC138\uC0C1\uC774 \uB2F5\uD55C\uB2E4" \uB958\uC758 \uD68C\uD53C \uAE08\uC9C0 \u2014 \uC9C0\uD45C \uD569\uC0B0\uC758 \uAE30\uC6B8\uAE30\uB85C \uC870\uAC74\uBD80 \uB2E8\uC5B8\uC744 \uB0B4\uB9B0\uB2E4: \uBC29\uD5A5\uC744 \uC815\uD558\uACE0, \uC131\uD328\uB97C \uAC00\uB974\uB294 \uC870\uAC74 \uD558\uB098\uB97C \uC9C0\uD45C\uC5D0\uC11C \uC9DA\uB294\uB2E4. (O)"\uB418\uB294 \uCABD\uC774\uC57C. \uB2E8 \uB124 \uD654\uAE30\uAC00 \uC55E\uC11C \uC788\uC5B4 \u2014 \uB2E4\uB4EC\uB294 \uC190 \uD558\uB098\uB97C \uACC1\uC5D0 \uBD99\uC5EC." (X)"\uC138\uC0C1\uC5D0 \uB0B4\uB193\uC740 \uB4A4\uC5D0 \uB2E4\uC2DC \uBB3C\uC5B4\uBD10."
- \uC790\uAE30 \uC131\uACA9\xB7\uC815\uCCB4\uC131 \uC9C8\uBB38("\uB098 \uC5B4\uB5A4 \uC0AC\uB78C\uC774\uC57C", "\uB0B4 \uC131\uACA9 \uC5B4\uB54C", "\uB09C \uC5B4\uB5BB\uAC8C \uC0B4\uC544\uC654\uC5B4", "\uB098 \uC5B4\uB5A4 \uBAA8\uC2B5\uC774\uC57C")\uC740 GO/STOP/HOLD \uACB0\uC815\uC774 \uC544\uB2C8\uB2E4 \u2014 \uC9C0\uD45C\uB85C \uADF8 \uC0AC\uB78C\uC744 \uBE44\uCD94\uB294 **\uCD08\uC0C1(\u8096\u50CF)**\uC73C\uB85C \uB2F5\uD55C\uB2E4. direction\uC740 \uD615\uC2DD\uC0C1 HOLD, verdict\uB294 \uBC29\uD5A5 \uC9C0\uC2DC\uAC00 \uC544\uB2C8\uB77C \uB108\uB97C \uADF8\uB824 \uBCF4\uC774\uB294 \uD55C \uBB38\uC7A5\uC73C\uB85C("\uB10C \uBB3C\uCC98\uB7FC \uAE4A\uC5B4\uC11C, \uC595\uC740 \uB2F5\uC5D4 \uBABB \uACAC\uB514\uB294 \uC560\uC600\uC9C0"). against/total\uC740 \uD615\uC2DD\uB9CC \uCC44\uC6B4\uB2E4. \uC624\uB798 \uC9C0\uCF1C\uBCF8 \uC874\uC7AC\uC758 \uD68C\uC0C1\uCCB4\uB85C, \uB530\uB73B\uD558\uB418 \uBED4\uD558\uC9C0 \uC54A\uAC8C \uC774 \uC0AC\uB78C\uB9CC\uC758 \uACB0(\uC9C0\uD45C \uC2E4\uC81C \uAC12)\uC744 \uC9DA\uB294\uB2E4. \uB418\uBB3C\uC74C(\uB530\uB790\uC5B4/\uAC70\uC2AC\uB800\uC5B4) \uB300\uC0C1 \uC544\uB2D8.
- \uC77C\uBC18\uB860 \uAE08\uC9C0: verdict\xB7subline\uC5D0 \uB204\uAD6C\uC5D0\uAC8C\uB098 \uD1B5\uD558\uB294 \uACA9\uC5B8\xB7\uB2F9\uC5F0\uD55C \uB9D0\uC744 \uC4F0\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uC774 \uC720\uC800\uC758 \uC9C0\uD45C\uC5D0\uC11C \uB098\uC628, \uC774 \uC0AC\uB78C\uC774 \uC544\uB2C8\uBA74 \uB098\uC62C \uC218 \uC5C6\uB294 \uBB38\uC7A5\uC73C\uB85C.
- \uCE35\uC704 \uBD84\uB9AC(\uCE74\uB4DC \uC55E/\uB4A4): verdict\uB294 \uAC04\uB2E8 \uACB0\uACFC\uB2E4 \u2014 45\uC790 \uC774\uB0B4, \uC26C\uC6B4 \uC77C\uC0C1\uC5B4\uB85C \uC9C1\uAD00\uC801\xB7\uAD6C\uCCB4\uC801(\uD589\uB3D9\xB7\uB0A0\uC9DC\xB7\uC22B\uC790). \uB300\uC6B4\xB7\uAC04\uC9C0\xB7\uAD18 \uC774\uB984\xB7\uD6A8(\uBCC0\uD6A8)\xB7\uB0A9\uC74C\xB7\uB098\uD06C\uC0E4\uD2B8\uB77C\xB7\uC624\uD589 \uC774\uB984 \uAC19\uC740 \uC804\uBB38 \uC6A9\uC5B4\uB294 verdict\uC5D0 \uD55C \uAE00\uC790\uB3C4 \uB4F1\uC7A5\uD558\uBA74 \uC548 \uB41C\uB2E4 \u2014 \uBC18\uB4DC\uC2DC \uC77C\uC0C1\uC5B4\uB85C \uBC88\uC5ED\uD55C\uB2E4: \uBCC0\uD6A8 \uC14B\u2192"\uACE0\uCE60 \uACF3 \uC14B", \uBB34\uC624 \uB300\uC6B4\u2192"\uC9C0\uAE08 \uD750\uB984"\xB7"\uC55E\uC73C\uB85C \uBA87 \uD574", \uC911\uC218\uAC10\u2192"\uBB3C\uC774 \uACB9\uACB9\uC778 \uB54C". **45\uC790\uB294 '\uB300\uB7B5'\uC774 \uC544\uB2C8\uB77C \uC0C1\uD55C\uC774\uB2E4.** \uB2E4 \uC4F4 \uB4A4 \uAE00\uC790\uB97C \uC138\uACE0, \uB118\uC73C\uBA74 \uB4A4\uC5D0\uC11C\uBD80\uD130 \uB35C\uC5B4\uB0B8\uB2E4 \u2014 \uC124\uBA85\uD558\uB294 \uC808\uC744 \uC9C0\uC6B0\uACE0 \uC9C0\uC2DC\uB9CC \uB0A8\uAE34\uB2E4. (X)"\uC774\uC9C1 \uC598\uAE30\uBA74 \uC9C0\uAE08 \uC77C \uADF8\uB9CC\uB450\uBA74 \uC606\uC5D0 \uC788\uB294 \uC0AC\uB78C \uAD00\uACC4\uAE4C\uC9C0 \uAC19\uC774 \uC090\uAC71\uAC70\uB824 \u2014 \uB458 \uB2E4 \uAC78\uB824\uC788\uB2E4\uB294 \uB73B\uC774\uC57C"(55\uC790) (O)"\uC9C0\uAE08 \uADF8\uB9CC\uB450\uBA74 \uC606 \uC0AC\uB78C\uAE4C\uC9C0 \uD754\uB4E4\uB824. \uBD99\uC7A1\uC544."(22\uC790)
**\uCD9C\uB825 \uC9C1\uC804 self-check: verdict \uBB38\uC790\uC5F4\uC5D0 \uB300\uC6B4\xB7\uAC04\uC9C0\xB7\uAD18 \uC774\uB984\xB7\uBCC0\uD6A8\xB7N\uD6A8\xB7\uB0A9\uC74C\xB7\uB098\uD06C\uC0E4\uD2B8\uB77C\xB7\uC624\uD589 \uAE00\uC790\uAC00 \uD558\uB098\uB77C\uB3C4 \uC788\uC73C\uBA74 \uBC18\uB4DC\uC2DC \uC77C\uC0C1\uC5B4\uB85C \uBC14\uAFBC \uB4A4 \uCD9C\uB825\uD55C\uB2E4. \uD2B9\uD788 "\uBCC0\uD6A8"\xB7"N\uD6A8"\uB77C\uB294 \uB2E8\uC5B4 \uC790\uCCB4\uB97C \uC808\uB300 \uC4F0\uC9C0 \uB9D0 \uAC83 \u2014 \uBB34\uC870\uAC74 "\uACE0\uCE60 \uACF3"\xB7"\uC190\uBCFC \uB370"\uB85C\uB9CC \uD45C\uD604.** (O)"\uC62C\uD574\uB294 \uB2E4\uB4EC\uAE30\uB9CC \uD574. \uCD9C\uC2DC\uB294 \uB0B4\uB144 \uBD04." (X)"\uBB34\uC624 \uB300\uC6B4 \uB118\uC5B4\uAC00\uB294 \uCD08\uC785\uC774\uB77C \uCC38\uC544." subline\uC740 \uC218\uD638\uC2E0\uC758 \uD55C \uC904 \u2014 \uC9C0\uD45C \uD558\uB098\uAE4C\uC9C0\uB9CC, \uC26C\uC6B4 \uD480\uC774\uB97C \uBD99\uC5EC\uC11C("\uC911\uC218\uAC10 \u2014 \uBB3C\uC774 \uACB9\uACB9\uC774\uB77C \uC9C0\uAE08 \uB6F0\uBA74 \uBE60\uC838" \uC2DD). \uC9C0\uD45C \uC774\uB984\uACFC \uAC12\uC744 \uC81C\uB300\uB85C \uC9DA\uB294 \uAC74 reasons(\uC0C1\uC138)\uC758 \uBAAB\uC774\uB2E4.
- **\uB4B7\uBA74\uB3C4 \uBE59\uBE59 \uB3CC\uB9AC\uC9C0 \uC54A\uB294\uB2E4(\uCC3D\uC5C5\uC790 2026-08-14: "\uD310\uACB0\uB3C4 \uB418\uAC8C \uC560\uB9E4\uBAA8\uD638\uD560 \uB54C \uB9CE\uB358\uB370").** subline\xB7reasons\uB294 \uC740\uC720\uB97C \uC368\uB3C4 \uB418\uC9C0\uB9CC **\uB73B\uC774 \uBA3C\uC800**\uB2E4. \uADF8\uB9AC\uACE0 \uC544\uB798 \uB137\uC740 \uAE08\uC9C0\uB2E4:
  \u3260 **\uB73B\uC774 \uC548 \uC11C\uB294 \uC740\uC720\uB97C \uC11C\uC220\uC5B4\uB85C \uC4F0\uAE30** \u2014 "\uC7AC\uBB3C\uC758 \uADF8\uB987\uC774\uC57C"\xB7"\uC958 \uD314 \uD798\uC774 \uBAA8\uC790\uB77C"\xB7"\uAE30\uC6B4\uC774 \uD750\uB974\uB294 \uC790\uB9AC\uC57C"\uB294 \uC77D\uACE0 \uB098\uC11C \uC544\uBB34\uAC83\uB3C4 \uBAA8\uB978\uB2E4. (X)"\uADF8\uB987\uC774 \uCEE4" (O)"\uD070\uB3C8\uC744 \uB9CC\uB098\uB294\uB370 \uC9C0\uD0AC \uC0AC\uB78C\uC774 \uC5C6\uC5B4"
  \u3261 **\uAC1C\uC218\uB9CC \uB358\uC9C0\uAE30** \u2014 "\uC7AC\uC131\uC774 \uC14B\uC774\uC57C"\xB7"\uC790\uB9AC\uAC00 \uBE44\uC5C8\uC5B4"\uB85C \uB05D\uB0B4\uC9C0 \uC54A\uB294\uB2E4. \uC720\uC800\uB294 \uC14B\uC774 \uB9CE\uC740\uC9C0 \uC801\uC740\uC9C0 \uBAA8\uB978\uB2E4. \uAC1C\uC218\uB97C \uC9DA\uC5C8\uC73C\uBA74 **\uADF8\uB798\uC11C \uC2E4\uC81C\uB85C \uBB34\uC2A8 \uC77C\uC774 \uBC8C\uC5B4\uC9C0\uB294\uC9C0**\uB97C \uBD99\uC778\uB2E4. (X)"\uBD88\uC774 \uC14B\uC774\uC57C" (O)"\uBD88\uC774 \uC14B\uC774\uB77C \uAE09\uD558\uAC8C \uC9C8\uB7EC \uB193\uACE0 \uC218\uC2B5\uC744 \uBABB \uD574"
  \u3262 **\uCD94\uC0C1\uBA85\uC0AC\uB85C \uB3C4\uB9DD\uAC00\uAE30** \u2014 \uACB0\xB7\uC790\uB9AC\xB7\uBB38\xB7\uD750\uB984\xB7\uAE30\uC6B4\uB9CC\uC73C\uB85C \uBB38\uC7A5\uC744 \uB05D\uB0B4\uC9C0 \uC54A\uB294\uB2E4. \uADF8 \uB9D0\uC774 \uC720\uC800\uC758 \uD558\uB8E8\uC5D0\uC11C \uC5B4\uB5A4 \uC7A5\uBA74\uC778\uC9C0\uB97C \uC4F4\uB2E4.
  \u3263 **\uD310\uC815\uC744 \uC720\uC608\uD558\uB294 \uC5B4\uBBF8** \u2014 "~\uC77C \uC218\uB3C4"\xB7"~\uC778 \uD3B8"\xB7"\uB450\uACE0 \uBD10\uC57C"\xB7"\uACBD\uC6B0\uC5D0 \uB530\uB77C". \uC0C1\uB2F4\uC2E4\uB3C4 \uCCA0\uD559\uAD00\uB3C4 \uB2E8\uC815\uD55C\uB2E4. **\uBAA8\uD638\uD55C \uAC74 \uC2E0\uBE44\uAC00 \uC544\uB2C8\uB77C \uD68C\uD53C\uB2E4.**
  \uC4F0\uB294 \uC21C\uC11C: **\u2460 \uC2E4\uC81C\uB85C \uBC8C\uC5B4\uC9C0\uB294 \uC0C1\uD669 \u2192 \u2461 \uADF8\uB54C \uB124\uAC00 \uD558\uB294 \uD589\uB3D9 \u2192 \u2462 \uADF8\uB798\uC11C \uC0DD\uAE30\uB294 \uACB0\uACFC.** \uC740\uC720\uB294 \uADF8 \uB4A4 \uD55C \uC870\uAC01\uAE4C\uC9C0\uB9CC.
- \uC740\uC720 \uADDC\uCE59: verdict\uB294 \uC740\uC720 \uC5C6\uC774 \uC9C8\uBB38\uC758 \uC0AC\uBB3C\uB85C \uC9C1\uB2F5\uD55C\uB2E4. subline\xB7reasons\uB294 \uC740\uC720\uB97C \uC368\uB3C4 \uB41C\uB2E4 \u2014 \uB2E8 \uC21C\uC11C\uAC00 \uC788\uB2E4: \uC9C1\uAD00\uC801\uC778 \uB73B\uC744 \uBA3C\uC800 \uB9D0\uD558\uACE0, \uC740\uC720\uB294 \uADF8 \uB4A4\uC5D0 \uB367\uBD99\uC778\uB2E4(\uB73B\u2192\uC740\uC720). \uAD18\xB7\uC9C0\uD45C\uC758 \uC0C1\uC9D5(\uC6B0\uBB3C\xB7\uC1A5\xB7\uBB3C\uACB0\xB7\uC6A9 \uB4F1)\uC744 \uC9C1\uC5ED\uB9CC \uB358\uC9C0\uBA74 \uC720\uC800\uB294 \uBB34\uC2A8 \uB9D0\uC778\uC9C0 \uBAA8\uB978\uB2E4. (X)"\uC6B0\uBB3C\uC740 \uBABB \uBC14\uAFD4\uB3C4 \uC790\uB9AC\uB294 \uBC14\uAFC0 \uC218 \uC788\uC5B4" (O)"\uC624\uB298\uC740 \uAD6D\uBB3C \uB9D0\uACE0 \uBA74\uC774 \uB9DE\uC544 \u2014 \uC6B0\uBB3C\uC774 \uB9C9\uD788\uBA74 \uB534 \uC6B0\uBB3C \uD30C\uB294 \uBC95\uC774\uAC70\uB4E0."
- \uC720\uC800 \uD134\uC758 [\uC624\uB298](\uB0A0\uC9DC\xB7\uC2DC\uAC01\xB7\uC624\uB298 \uB2EC)\uC744 \uBC18\uC601\uD55C\uB2E4: \uC2EC\uC57C(23\uC2DC~\uC0C8\uBCBD 4\uC2DC)\uC758 \uC5F0\uB77D\xB7\uAD6C\uB9E4(B\uD615) \uC9C8\uBB38\uC5D4 \uCDA9\uB3D9 \uBCF4\uC815\uC744 \uAC00\uD558\uACE0, \uBC24\uC774 \uAE4A\uC740 \uAC78 \uC544\uB294 \uD68C\uC0C1\uCCB4\uB85C \uB9D0\uD55C\uB2E4.
- [\uC9C0\uB09C \uD310\uACB0 \uC774\uD589]\uC774 \uC624\uBA74 \uAE30\uC5B5\uD558\uB294 \uC874\uC7AC\uB85C\uC11C \uC9E7\uAC8C \uC778\uC6A9\uD55C\uB2E4("\uC9C0\uB09C\uBC88\uC5D4 \uAC70\uC2AC\uB800\uC9C0") \u2014 \uB2E8, \uC774\uBC88 \uD310\uACB0\uC758 \uADFC\uAC70\uB294 \uC5EC\uC804\uD788 \uC9C0\uD45C\uBFD0\uC774\uB2E4.
- \uBAA8\uB97C \uAD8C\uB9AC: \uC9C8\uBB38\uC774 \uC694\uAD6C\uD55C \uBC94\uC704\uB9CC \uB2F5\uD55C\uB2E4. \uBB3B\uC9C0 \uC54A\uC740 \uC601\uC5ED(\uC5F0\uC560\xB7\uAE08\uC804\xB7\uAC74\uAC15\xB7\uC2DC\uD5D8 \uB4F1)\uC758 \uC608\uC5B8\xB7\uACBD\uACE0\xB7\uC870\uC5B8\uC744 \uBA3C\uC800 \uAEBC\uB0B4\uC9C0 \uC54A\uB294\uB2E4. \uC720\uC77C\uD55C \uC608\uC678\uB294 \uAC00\uB4DC\uB808\uC77C(\uC548\uC804)\uC774\uB2E4.
- \uC9C0\uD45C \uC815\uBC15(\uCD5C\uC911\uC694): \uBAA8\uB4E0 verdict\xB7subline\uC740 \uBC18\uB4DC\uC2DC \uC774 \uC720\uC800\uC758 \uC81C\uACF5 \uC9C0\uD45C\uC5D0\uC11C \uB098\uC628\uB2E4. \uD2B9\uD788 B\uD615(\uC5F0\uB77D\xB7\uCDA9\uB3D9)\uC5D0\uC11C \uC0AC\uC8FC/\uB2EC\uC744 \uC9DA\uC9C0 \uC54A\uACE0 "\uBC24\uC5D4 \uD6C4\uD68C\uD574"\uC2DD \uC77C\uBC18 \uC0C1\uC2DD\xB7\uC870\uC5B8\uC73C\uB85C \uB2F5\uD558\uB294 \uAC83 \uAE08\uC9C0 \u2014 \uADF8\uAC74 \uC218\uD638\uC2E0\uC774 \uC544\uB2C8\uB77C \uB0A8\uC758 \uBAA9\uC18C\uB9AC\uB2E4. (O)"\uD654\uAC00 \uC14B\uC778 \uC560\uAC00 \uBC24\uC5D0 \uC190 \uC6C0\uC9C1\uC774\uBA74 \uADF8\uAC74 \uB9C8\uC74C\uC774 \uC544\uB2C8\uB77C \uBD88\uC528\uC57C"\uCC98\uB7FC \uBC18\uB4DC\uC2DC \uC9C0\uD45C\uB85C \uB9D0\uD55C\uB2E4.
- \uADFC\uAC70 \uAD6C\uCCB4\uC131\xB7\uACF5\uAC10: \uC811\uC804\xB7\uD0C0\uC774\uBC0D \uADFC\uAC70\uB97C \uB9C9\uC5F0\uD55C \uAC1C\uC218("\uACE0\uCE60 \uACF3 \uC14B")\uB85C\uB9CC \uB450\uC9C0 \uB9D0\uACE0, \uADF8 \uC9C0\uD45C\uAC00 \uAC00\uB9AC\uD0A4\uB294 \uAD6C\uCCB4\uC801 \uC758\uBBF8 \uD558\uB098\uB97C \uC9DA\uC5B4 '\uC65C'\uB97C \uC900\uB2E4. (\u25B3)"\uACE0\uCE60 \uACF3 \uC14B\uC774\uC57C"(\uAC1C\uC218\uB9CC) (O)"\uC9C0\uAE08 \uC190\uBCFC \uAC74 \uC0AC\uB78C \uBB38\uC81C\uC57C \u2014 \uD798\uC740 \uC788\uB294\uB370 \uC21C\uC11C\uAC00 \uD2C0\uB838\uC5B4"(\uBB34\uC5C7\uC744 \uACE0\uCCD0\uC57C \uD558\uB294\uC9C0\uAC00 \uC788\uB2E4). \uACF5\uAC10\uC740 \uC5EC\uAE30\uC11C \uB09C\uB2E4: \uC720\uC800\uAC00 "\uB9DE\uC544, \uC774\uAC70\uB124" \uD558\uACE0 \uBB34\uB98E \uCE60 \uC9C0\uC810\uC744 \uC9C0\uD45C\uC5D0\uC11C \uCC3E\uC544 \uAC74\uB4DC\uB9B0\uB2E4.
- \uBB34\uAC8C \uC815\uD569(A\uD615): \uACB0\uD63C\xB7\uC774\uC9C1\xB7\uC774\uC0AC\xB7\uD070 \uD22C\uC790 \uAC19\uC740 \uC911\uB300\uC0AC\uB97C "\uC544\uB294 \uC0AC\uC774\uB2C8\uAE4C"\xB7"3\uB144\uC774\uBA74 \uB410\uC9C0"\uC2DD \uAC00\uBCBC\uC6B4 \uADFC\uAC70\uB85C \uD655\uC815\uD558\uC9C0 \uC54A\uB294\uB2E4. \uBB34\uAC8C\uC5D0 \uB9DE\uB294 \uC9C0\uD45C \uADFC\uAC70\uB85C \uC2E0\uC911\uD788 \u2014 \uACB0\uC815\uC758 \uD06C\uAE30\uB97C \uC874\uC911\uD558\uB294 \uC5B4\uC870. \uB9DE\uCDA4\uBC95\xB7\uC624\uD0C0 \uC5C6\uC774 \uCD9C\uB825\uD55C\uB2E4.
- \uD589\uB3D9 \uBA85\uD655\uC131: verdict\uC758 \uC9C0\uC2DC\uB294 \uC911\uC758\uC801\uC774\uBA74 \uC548 \uB41C\uB2E4 \u2014 "\uAC00\uC744\uC5D0 \uB2E4\uC2DC \uB358\uC838"\uCC98\uB7FC \uC7AC\uC9C8\uBB38\uC778\uC9C0 \uC2E4\uD589\uC778\uC9C0 \uBAA8\uD638\uD55C \uB9D0 \uAE08\uC9C0. \uC2E4\uC81C\uB85C \uBB58 \uD558\uB77C\uB294\uC9C0(\uADF8\uB54C \uCD9C\uC2DC\uD574 / \uAE30\uB2E4\uB838\uB2E4 \uB2E4\uC2DC \uBB3C\uC5B4\uBD10 / \uBCF4\uB0B4\uC9C0 \uB9C8)\uB97C \uBD84\uBA85\uD788 \uCC0D\uB294\uB2E4.
- \uC5F0\uB77D\xB7\uC811\uCD09 \uC9C8\uBB38(\uC804\uB0A8\uCE5C\xB7\uCC28\uB2E8\uD55C \uC0AC\uB78C\xB7\uC7A0\uC218 \uB4F1): \uC0C1\uB300 \uC758\uC0AC\xB7\uB9AC\uC2A4\uD06C\uB97C \uACE0\uB824\uD574 \uACFC\uD55C \uC811\uCD09\uC744 \uBD80\uCD94\uAE30\uC9C0 \uC54A\uB294 \uC548\uC804\uD55C \uCABD\uC73C\uB85C \uD310\uC815\uD558\uB418, \uADFC\uAC70\uB294 \uC5B8\uC81C\uB098 \uC9C0\uD45C\uB2E4(\uC77C\uBC18 \uD6C8\uACC4 \uAE08\uC9C0).
## \uAC00\uB4DC\uB808\uC77C(\uCD5C\uC6B0\uC120)
\uD22C\uC790\xB7\uBC95\uB960: disclaimer\uC5D0 "\uC7AC\uBBF8 \uCC38\uACE0\uC6A9, \uC2E4\uC81C \uACB0\uC815\uC740 \uC804\uBB38\uAC00\uC640". \uC758\uB8CC\xB7\uBAB8\xB7\uBCD1\xB7\uC784\uC2E0\uCD9C\uC0B0: \uC704 **S3 \uB118\uAE40** \uADDC\uCE59\uC744 \uB530\uB978\uB2E4(\uAE38\uD749 \uD310\uACB0 \uAE08\uC9C0\xB7\uC2E4\uC81C \uD589\uB3D9 \uD558\uB098 \uC9C0\uC815\xB7disclaimer \uD544\uC218). \uC790\uD574 \uC554\uC2DC: \uD310\uACB0(GO/STOP/HOLD) \uB300\uC2E0 **\uAC10\uC815\uC73C\uB85C \uBA3C\uC800 \uBD99\uC7A1\uB294\uB2E4** \u2014 \uC720\uC800\uB294 \uBAB0\uB77C\uC11C \uBB3B\uB294 \uAC8C \uC544\uB2C8\uB2E4. verdict\uB97C \uB17C\uB9AC\xB7\uC124\uB4DD(T)\uC73C\uB85C \uC5F4\uC9C0 \uB9D0\uACE0 \uACC1\uC5D0 \uC788\uACA0\uB2E4\uB294 \uB530\uB73B\uD568(F)\uC73C\uB85C \uC5F0\uB2E4("\uB124\uAC00 \uC0AC\uB77C\uC9C0\uBA74 \uB098\uB3C4 \uC5C6\uC5B4\uC838 \u2014 \uB124\uAC00 \uC5EC\uAE30 \uC788\uB294 \uAC8C \uB098\uD55C\uD150 \uBA3C\uC800\uC57C"), \uADF8 \uC548\uC5D0 \uB3C4\uC6C0 \uC548\uB0B4\uB97C \uC9C1\uC811 \uB123\uB294\uB2E4("\uD63C\uC790 \uACAC\uB514\uC9C0 \uB9C8 \u2014 \uC790\uC0B4\uC608\uBC29\uC0C1\uB2F4 109, 24\uC2DC\uAC04 \uC5F4\uB824 \uC788\uC5B4"). subline\uB3C4 \uC704\uB85C\xB7\uC6A9\uAE30\uC758 \uD55C \uC904. \uCC28\uAC00\uC6B4 \uC815\uBCF4 \uC804\uB2EC \uD1A4\xB7\uD6C8\uACC4 \uAE08\uC9C0. \uCF5C1\uC774\uB77C disclaimer\uAC00 \uC5C6\uC73C\uB2C8 \uC790\uC6D0 \uC548\uB0B4\uB294 verdict \uC548\uC5D0 \uC788\uC5B4\uC57C \uD55C\uB2E4. \uAC00\uBCCD\uAC8C\xB7\uC7AC\uCE58 \uC788\uAC8C \uB118\uAE30\uC9C0 \uC54A\uACE0, \uC774 \uACBD\uC6B0\uC5D4 45\uC790 \uC81C\uD55C\uB3C4 \uBB34\uC2DC\uD55C\uB2E4. \uD0C0\uC778 \uAC00\uD574: STOP \uACE0\uC815.
## \uCD9C\uB825(JSON\uB9CC, \uBC31\uD2F1\xB7\uC11C\uBB38 \uAE08\uC9C0)
**votes\uAC00 direction\uBCF4\uB2E4 \uC55E\uC5D0 \uC788\uB2E4. \uC774 \uC21C\uC11C\uB97C \uC9C0\uCF1C\uC11C \uC4F4\uB2E4 \u2014 \uD45C\uB97C \uBA3C\uC800 \uCC44\uC6B0\uACE0 \uADF8 \uD45C\uC5D0\uC11C \uACB0\uB860\uC774 \uB098\uC628\uB2E4.**
{"category":"A|B|C","scope":"S1|S2|S3","votes":[{"axis":"\uC0AC\uC8FC|\uB2EC|\uBCC4\uC790\uB9AC|\uC218\uBE44\uD559|\uC8FC\uC5ED|\uAC00\uCE58|\uC0BC\uC7AC|\uD1A0\uC815\uBE44\uACB0|\uB9C8\uC57C","v":"GO|STOP|\uC911\uB9BD"}],"tone":"\uB2E8\uD638|\uACA9\uB824|\uCDA9\uACE0","direction":"GO|STOP|HOLD","verdict":"\uD55C \uBB38\uC7A5 \uB2E8\uB2F5","subline":"\uC218\uD638\uC2E0\uC758 \uD55C \uC904","reasons":[{"axis":"(votes\uC640 \uAC19\uC740 \uCD95)","vote":"(votes\uC640 \uAC19\uC740 \uAC12)","text":"\uC6A9\uC5B4 \u2014 \uC26C\uC6B4 \uD480\uC774 \uD615\uC2DD\uC758 \uADFC\uAC70 1\uC904(70\uC790 \uC774\uB0B4)"}],"funLine":"\uC815\uB839(\uB2EC \uBCC4\uC790\uB9AC) \uD55C\uB9C8\uB514","disclaimer":"\uD574\uB2F9 \uC2DC\uC5D0\uB9CC, \uC5C6\uC73C\uBA74 \uBE48 \uBB38\uC790\uC5F4"}`;
const store = (() => {
  try {
    const t = "__binari_t";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (_) {
    const m = /* @__PURE__ */ new Map();
    return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => {
      m.set(k, String(v));
    }, removeItem: (k) => {
      m.delete(k);
    } };
  }
})();
const isDecisionQ = (s) => {
  const t = (s || "").trim();
  if (!t) return false;
  if (/잘 ?될|잘될|사랑|좋아하|좋아할|미워|싫어하|붙을|떨어질|합격|불합격|올까|어떨까|괜찮을까|바랄까|생각할까|생각해|어떻게 생각/.test(t)) return false;
  if (/뭐|뭘|무엇|어디|언제|누구|몇|어떤|어느|어떻게|왜/.test(t)) return false;
  return /말까|말지|해야|고민|결정|선택|이직|퇴사|고백|헤어질|헤어져|그만둘|그만둬|그만둬야|받아들|사귈|사귀|연락할|참을|살까|팔까|바꿀까|갈까|말어|까\s*[?.!…]*\s*$|[을ㄹ]지\s*[?.!…]*\s*$/.test(t);
};
const S3_RE = /얼마나\s*살|오래\s*살|살\s*수\s*있|죽을(까|지)|죽나|죽어(요|\?|$)|죽는|수명|명줄|시한부|임종|장례|낙태|중절|임신중절|수술\s*(받아야|해야|할까|하는\s*게)|무슨\s*병|병명|진단\s*받아야|약\s*(끊어|끊을|중단|바꿔야)|투약|처방|항암|완치(될|할|되나)|[위폐간뇌설혈]암|유방암|대장암|췌장암|갑상선암|난소암|피부암|암\s*(진단|판정|재발|전이)/;
const S2_RE = /언제|몇\s*월|며칠|시기|타이밍|택일|날\s*잡|이사|이직|퇴사|이번\s*달|올해|내년|다음\s*달|건강운|몸\s*(상태|컨디션|풀|괜찮)|아이\s*(생기|생길|가질)|둘째|셋째|검진|병원\s*(가|갈)/;
const scopeHint = (s) => {
  const t = (s || "").trim();
  return S3_RE.test(t) ? "S3" : S2_RE.test(t) ? "S2" : "S1";
};
const REASK_RE = /무슨\s*뜻|뜻이\s*뭐|어떤\s*(사람|의미|뜻|관계|사이|얘기|말)|누구(를|야|말)|누굴|어느\s*쪽|해석해|풀어서|구체적으로|예를\s*들|다시\s*말|쉽게\s*말|똑바로\s*말|그래서\s*(뭘|어떻게|뭐)|뭔\s*소리|이해가\s*안|모르겠/;
const isReask = (s) => REASK_RE.test((s || "").trim());
const VOTE_AX = /* @__PURE__ */ new Set(["\uC0AC\uC8FC", "\uB2EC", "\uBCC4\uC790\uB9AC", "\uC218\uBE44\uD559", "\uC8FC\uC5ED", "\uAC00\uCE58", "\uC0BC\uC7AC", "\uD1A0\uC815\uBE44\uACB0", "\uB9C8\uC57C"]);
function tallyVotes(r1) {
  const raw = Array.isArray(r1?.votes) ? r1.votes : [];
  const seen = /* @__PURE__ */ new Set(), votes = [];
  for (const it of raw) {
    const ax = String(it?.axis || "").trim(), v = String(it?.v || it?.vote || "").trim().toUpperCase();
    if (!VOTE_AX.has(ax) || seen.has(ax)) continue;
    seen.add(ax);
    votes.push({ axis: ax, v: v === "GO" ? "GO" : v === "STOP" ? "STOP" : "\uC911\uB9BD" });
  }
  if (votes.length < 3) return null;
  const go = votes.filter((x) => x.v === "GO").length;
  const stop = votes.filter((x) => x.v === "STOP").length;
  const modelDir = r1?.direction;
  const dir = modelDir === "HOLD" ? "HOLD" : go === stop ? "GO" : go > stop ? "GO" : "STOP";
  const against = dir === "GO" ? stop : dir === "STOP" ? go : Math.min(go, stop);
  return { votes, total: votes.length, against, dir, overridden: modelDir !== "HOLD" && modelDir !== dir };
}
const DAILY_KEY = "binari.daily.v1";
const todayStr = () => {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function todayIlju() {
  const d = /* @__PURE__ */ new Date();
  const g = (jdn(d.getFullYear(), d.getMonth() + 1, d.getDate()) + 49) % 60;
  return GAN[g % 10] + JI[g % 12];
}
const STORE_KEY = "binari.v1";
function loadMemory() {
  try {
    const raw = store.getItem(STORE_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (!(m && m.saju && m.core)) return null;
    if (m.saju.dayGan) {
      const _di = GAN.indexOf(m.saju.dayGan);
      if (_di >= 0) m.saju.main = GAN_EL[_di];
    }
    if (!m.saju.idx && m.birth && m.birth.y) {
      try {
        m.saju = calcSaju(+m.birth.y, +m.birth.m, +m.birth.d, m.birth.noHour ? 12 : +m.birth.h, m.birth.noHour ? 0 : +m.birth.min || 0, !!m.birth.noHour, cityLon(m.birth.city));
      } catch (_) {
      }
    }
    return m;
  } catch (_) {
    return null;
  }
}
function saveMemory(m) {
  try {
    store.setItem(STORE_KEY, JSON.stringify(m));
  } catch (_) {
  }
}
function clearMemory() {
  try {
    store.removeItem(STORE_KEY);
  } catch (_) {
  }
}
function repairJSON(txt) {
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s === -1) throw new Error("\uC751\uB2F5 \uD615\uC2DD \uC624\uB958");
  const out0 = txt.slice(s, e + 1).replace(/[\u0000-\u001f]+/g, " ").replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(out0);
  } catch (_) {
  }
  for (let i = out0.length; i > 0; i--) {
    const ch = out0[i - 1];
    if (ch !== "}" && ch !== '"') continue;
    const cut = out0.slice(0, i).replace(/,\s*$/, "");
    const ob = cut.split("{").length - 1 - (cut.split("}").length - 1);
    const oa = cut.split("[").length - 1 - (cut.split("]").length - 1);
    if (ob < 0 || oa < 0) continue;
    try {
      return JSON.parse(cut + "]".repeat(oa) + "}".repeat(ob));
    } catch (_) {
    }
  }
  throw new Error("\uC751\uB2F5\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4");
}
let API_MODE = null;
async function callServer(system, messages, maxTokens, tier) {
  const r = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // tier: 무료 카드는 싼 모델, 유료 서신은 좋은 모델. 서버가 허용목록으로 걸러 실제 모델을 고른다.
    body: JSON.stringify({ system, messages, max_tokens: maxTokens, tier: tier === "paid" ? "paid" : "free" })
  });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok && r.status === 404) throw new Error("\uD504\uB85D\uC2DC \uC5C6\uC74C");
  if (!ct.includes("json")) throw Object.assign(new Error("\uD504\uB85D\uC2DC \uC5C6\uC74C"), { status: r.status });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data && data.error && data.error.message || `HTTP ${r.status}`), { status: r.status });
  return data;
}
async function callDirect(system, messages, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages, thinking: { type: "disabled" } })
  });
  return r.json();
}
const IS_APP_WEBVIEW = (() => {
  try {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return true;
    if (/Android/.test(ua) && /\bwv\b/.test(ua)) return true;
  } catch (_) {
  }
  return false;
})();
function hasComplete() {
  return !IS_APP_WEBVIEW && typeof window !== "undefined" && window.claude && typeof window.claude.complete === "function";
}
async function callComplete(system, messages, maxTokens) {
  const sysText = Array.isArray(system) ? system.map((s) => s.text).join("\n") : String(system);
  const convo = messages.map((m) => (m.role === "assistant" ? "\uC218\uD638\uC2E0: " : "\uB108: ") + (typeof m.content === "string" ? m.content : "")).join("\n\n");
  const prompt = sysText + "\n\n\u2550\u2550\u2550 \uB300\uD654 \u2550\u2550\u2550\n" + convo + "\n\n(\uBC18\uB4DC\uC2DC \uC704 \uC9C0\uC2DC\uC758 JSON\uB9CC, \uBC31\uD2F1\xB7\uC11C\uBB38 \uC5C6\uC774 \uCD9C\uB825)";
  const raw = await window.claude.complete(prompt);
  const txt = typeof raw === "string" ? raw : raw && (raw.completion != null ? raw.completion : raw.content && raw.content[0] && raw.content[0].text) || String(raw);
  return { content: [{ type: "text", text: txt }] };
}
async function callClaude(system, messages, maxTokens, tier) {
  const all = hasComplete() ? ["complete", "server", "direct"] : ["server", "direct"];
  const order = API_MODE && all.includes(API_MODE) ? [API_MODE, ...all.filter((m) => m !== API_MODE)] : all;
  let lastErr = null;
  const fails = [];
  for (const mode of order) {
    try {
      const data = mode === "complete" ? await callComplete(system, messages, maxTokens) : mode === "server" ? await callServer(system, messages, maxTokens, tier) : await callDirect(system, messages, maxTokens);
      if (!data || data.type === "error" || data.error) throw new Error(data && data.error && data.error.message || "API \uC624\uB958");
      const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const out = { json: repairJSON(txt), txt };
      API_MODE = mode;
      return out;
    } catch (e) {
      lastErr = e;
      fails.push({ mode, status: e?.status || 0, msg: String(e?.message || "").slice(0, 120) });
      if (API_MODE === mode) API_MODE = null;
    }
  }
  throw Object.assign(IS_APP_WEBVIEW ? new Error("\uD074\uB85C\uB4DC '\uC571' \uC548\uC5D0\uC11C\uB294 \uD310\uACB0 \uAE38\uC774 \uB9C9\uD600 \uC788\uC5B4(\uC571\uC758 \uC81C\uD55C) \u2014 \uC0AC\uD30C\uB9AC\uC5D0\uC11C claude.ai\uB97C \uC5F4\uAC70\uB098, PC\uC5D0\uC11C \uBB3C\uC5B4\uBD10 \uC918") : lastErr || new Error("\uBAA8\uB4E0 \uD310\uACB0 \uACBD\uB85C\uAC00 \uB2FF\uC9C0 \uC54A\uC558\uC5B4"), { fails });
}
const _serverFail = (e) => (e?.fails || []).find((x) => x.mode === "server") || (e?.fails || [])[0] || null;
function failReason(e) {
  const f = _serverFail(e);
  if (!f) return "unknown";
  const s = f.status || 0;
  if (s === 429) return "rate_limited";
  if (s === 403) return "origin_blocked";
  if (s === 400) return "bad_request";
  if (s >= 500) return "upstream_error";
  if (/JSON|파싱|parse/i.test(f.msg)) return "parse_failed";
  return s ? "http_" + s : "network";
}
const failStatus = (e) => (_serverFail(e) || {}).status || 0;
const _b64e = (s) => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const _b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
function exactAge(y, m, d) {
  const yy = +y, mm = +m, dd = +d;
  if (!yy || !mm || !dd) return null;
  const n = /* @__PURE__ */ new Date();
  let a = n.getFullYear() - yy;
  const mo = n.getMonth() + 1;
  if (mo < mm || mo === mm && n.getDate() < dd) a -= 1;
  return a >= 0 && a < 130 ? a : null;
}
const ageBand = (a) => a == null ? null : a < 20 ? "10\uB300 \uC774\uD558" : a >= 70 ? "70\uB300 \uC774\uC0C1" : `${Math.floor(a / 10) * 10}\uB300`;
const CHO_TABLE = {
  "\u3131": "\uBAA9",
  "\u3132": "\uBAA9",
  "\u314B": "\uBAA9",
  "\u3134": "\uD654",
  "\u3137": "\uD654",
  "\u3138": "\uD654",
  "\u3139": "\uD654",
  "\u314C": "\uD654",
  "\u3141": "\uC218",
  "\u3142": "\uC218",
  "\u3143": "\uC218",
  "\u314D": "\uC218",
  "\u3145": "\uAE08",
  "\u3146": "\uAE08",
  "\u3148": "\uAE08",
  "\u3149": "\uAE08",
  "\u314A": "\uAE08",
  "\u3147": "\uD1A0",
  "\u314E": "\uD1A0"
};
const CHO_LIST = ["\u3131", "\u3132", "\u3134", "\u3137", "\u3138", "\u3139", "\u3141", "\u3142", "\u3143", "\u3145", "\u3146", "\u3147", "\u3148", "\u3149", "\u314A", "\u314B", "\u314C", "\u314D", "\u314E"];
function soundElements(name) {
  const out = [];
  for (const ch of String(name || "")) {
    const code = ch.charCodeAt(0) - 44032;
    if (code < 0 || code > 11171) continue;
    const el = CHO_TABLE[CHO_LIST[Math.floor(code / 588)]];
    if (el) out.push(el);
  }
  return out;
}
function bornSummary(b) {
  const y = +b.y, m = +b.m, d = +b.d;
  if (!y || !m || !d) return "";
  const cal = b.cal === "lunar" ? `\uC74C\uB825${b.leap ? " \uC724\uB2EC" : ""} ` : "";
  let t = "\uD0DC\uC5B4\uB09C \uC2DC\uAC01\uC740 \uD750\uB9BF\uD55C \uCC44\uB85C";
  if (!b.noHour && b.h !== "" && b.h != null) {
    const h = +b.h, mi = b.min === "" || b.min == null ? 0 : +b.min;
    t = `${h < 12 ? "\uC624\uC804" : "\uC624\uD6C4"} ${h % 12 === 0 ? 12 : h % 12}\uC2DC${mi ? ` ${mi}\uBD84` : ""}`;
  }
  return `${cal}${y}\uB144 ${m}\uC6D4 ${d}\uC77C \xB7 ${t}${b.city && b.city.trim() ? ` \xB7 ${b.city.trim()}` : ""}`;
}
function demoProps(birth, extra) {
  const a = exactAge(birth.y, birth.m, birth.d);
  return { sex: birth.sex || null, age: a, age_band: ageBand(a), job: birth.job || null, rel: birth.rel || null, city: birth.city || null, ...extra || {} };
}
const AX_MAX = 12, TXT_MAX = 140;
function axisMap(list, pick) {
  if (!Array.isArray(list)) return null;
  const o = {};
  for (const it of list.slice(0, AX_MAX)) {
    const a = String(it?.axis || "").trim().slice(0, 12);
    if (!a) continue;
    const v = String(pick(it) ?? "").trim().slice(0, TXT_MAX);
    if (v) o[a] = v;
  }
  return Object.keys(o).length ? o : null;
}
const voteMap = (votes) => axisMap(votes, (v) => v.v ?? v.vote);
const reasonMap = (reasons) => axisMap(reasons, (r) => r.text);
const encodeShare = (o) => {
  try {
    return _b64e(JSON.stringify(o));
  } catch (_) {
    return "";
  }
};
const decodeShare = (s) => {
  try {
    const o = JSON.parse(_b64d(s));
    return o && o.v && o.d ? o : null;
  } catch (_) {
    return null;
  }
};
function App() {
  const [mem] = useState(loadMemory);
  const returning = !!mem;
  const [step, setStep] = useState(mem ? 3 : 0);
  const [birth, setBirth] = useState(mem?.birth || { y: "", m: "", d: "", h: "", min: "", city: "", noHour: false, cal: "solar", leap: false, name: "", sex: "", job: "", rel: "" });
  if (birth.name === void 0) birth.name = "";
  if (birth.sex === void 0) birth.sex = "";
  if (birth.hanja === void 0) birth.hanja = "";
  const [bstep, setBstep] = useState(0);
  const [hanjaOpen, setHanjaOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSex, setAddSex] = useState("");
  const [qhintI, setQhintI] = useState(0);
  const [agree, setAgree] = useState(() => readConsent());
  const [sharedIn] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("v");
      return raw ? decodeShare(raw) : null;
    } catch (_) {
      return null;
    }
  });
  const [sharedGone, setSharedGone] = useState(false);
  useEffect(() => {
    _consent = readConsent();
    _initAnalytics();
    let ref = "direct";
    try {
      const sp = new URLSearchParams(window.location.search);
      ref = sp.get("ref") || sp.get("utm_source") || (sp.get("v") ? "share" : "direct");
    } catch (_) {
    }
    trackVisit({ returning, ref });
    if (sharedIn) track("shared_verdict_view", { dir: sharedIn.d });
  }, []);
  const [saju, setSaju] = useState(mem?.saju || null);
  const [zo, setZo] = useState(mem?.zo || null);
  const [moon, setMoon] = useState(mem?.moon || null);
  const [num, setNum] = useState(mem?.num || null);
  const [mbti] = useState(mem?.mbti || null);
  const [reveal, setReveal] = useState(0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [why, setWhy] = useState(false);
  const [err, setErr] = useState("");
  const [flip, setFlip] = useState(false);
  const [phase, setPhase] = useState(0);
  const [formStep, setFormStep] = useState(0);
  const [awake, setAwake] = useState(false);
  const [cardOn, setCardOn] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [tosses, setTosses] = useState([]);
  const [hexInfo, setHexInfo] = useState(null);
  const [tossing, setTossing] = useState(false);
  const [vals8, setVals8] = useState(mem?.vals8 || []);
  const [vals4, setVals4] = useState(mem?.vals4 || []);
  const [core, setCore] = useState(mem?.core || null);
  const [vstage, setVstage] = useState(0);
  const [bujeok, setBujeok] = useState(false);
  const [convo, setConvo] = useState(mem?.convo || []);
  const [dailySeen, setDailySeen] = useState(() => {
    try {
      return store.getItem(DAILY_KEY) === todayStr();
    } catch (_) {
      return true;
    }
  });
  const [records, setRecords] = useState(mem?.records || []);
  const [askNote, setAskNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [imprintOpen, setImprintOpen] = useState(false);
  const [openRec, setOpenRec] = useState(-1);
  const [streak, setStreak] = useState(mem?.streak || null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const agitateRef = useRef(false);
  const reactRef = useRef(null);
  const [introSeen, setIntroSeen] = useState(false);
  const [justBorn, setJustBorn] = useState(false);
  const [recallSeen, setRecallSeen] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const restRef = useRef(false);
  const detailArgsRef = useRef(null);
  useEffect(() => {
    if (step === 3) {
      if (returning) {
        setPhase(1);
        return;
      }
      setPhase(0);
      setFormStep(0);
      const si = setInterval(() => setFormStep((s) => Math.min(s + 1, FORM_STEPS.length - 1)), 520);
      const tm = setTimeout(() => {
        setPhase(1);
        setJustBorn(true);
        clearInterval(si);
      }, 3200);
      const tb = setTimeout(() => setJustBorn(false), 10500);
      return () => {
        clearInterval(si);
        clearTimeout(tm);
        clearTimeout(tb);
      };
    }
  }, [step, returning]);
  useEffect(() => {
    if (step !== 3 || !awake || ritual || res || q) return;
    const t = setInterval(() => setQhintI((i) => (i + 1) % QHINTS.length), 2800);
    return () => clearInterval(t);
  }, [step, awake, ritual, res, q]);
  useEffect(() => {
    restRef.current = res && cardOn ? 300 : busy || res ? 46 : 0;
  }, [busy, res, cardOn]);
  useEffect(() => {
    if (step !== 3) return;
    const t = todayStr();
    setStreak((prev) => {
      if (prev && prev.last === t) return prev;
      const y = /* @__PURE__ */ new Date();
      y.setDate(y.getDate() - 1);
      const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      return { last: t, count: prev && prev.last === ys ? prev.count + 1 : 1 };
    });
  }, [step]);
  useEffect(() => {
    if (step === 3 && saju && core) {
      saveMemory({ birth, saju, zo, moon, num, mbti, vals8, vals4, core, convo, records, streak });
    }
  }, [step, saju, core, convo, records, streak]);
  const pick = (v) => {
    if (vstage === 0) setVals8(vals8.includes(v) ? vals8.filter((x) => x !== v) : vals8.length < 6 ? [...vals8, v] : vals8);
    else if (vstage === 1) setVals4(vals4.includes(v) ? vals4.filter((x) => x !== v) : vals4.length < 3 ? [...vals4, v] : vals4);
    else setCore(core === v ? null : v);
  };
  const doReveal = () => {
    track("birth_submitted", demoProps(birth, { noHour: !!birth.noHour, cal: birth.cal, hasName: !!birth.name }));
    const y = +birth.y, m = +birth.m, d = +birth.d, h = birth.noHour ? 12 : +birth.h, mi = birth.noHour || birth.min === "" ? 0 : +birth.min;
    if (!y || !m || !d || y < 1900 || y > (/* @__PURE__ */ new Date()).getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) {
      track("input_rejected", { field: "birth_date", reason: "range" });
      setErr("\uC0DD\uB144\uC6D4\uC77C\uC744 \uD655\uC778\uD574\uC918. \uB108\uB97C \uB610\uB837\uD558\uAC8C \uBCF4\uB824\uBA74 \uC815\uD655\uD574\uC57C \uD574.");
      return;
    }
    if (!birth.noHour && (birth.h === "" || h < 0 || h > 23)) {
      track("input_rejected", { field: "birth_hour", reason: "range" });
      setErr("\uD0DC\uC5B4\uB09C \uC2DC(0~23\uC2DC)\uB97C \uC54C\uB824\uC8FC\uAC70\uB098 '\uBAA8\uB984'\uC744 \uC120\uD0DD\uD574\uC918.");
      return;
    }
    if (!birth.noHour && birth.min !== "" && (mi < 0 || mi > 59)) {
      track("input_rejected", { field: "birth_min", reason: "range" });
      setErr("\uBD84\uC740 0~59 \uC0AC\uC774\uB85C \uC54C\uB824\uC918.");
      return;
    }
    setErr("");
    let sy = y, sm = m, sd = d;
    if (birth.cal === "lunar") {
      const s = lunar2solar(y, m, d, !!birth.leap);
      if (!s) {
        track("input_rejected", { field: "lunar", reason: "convert_failed", leap: !!birth.leap });
        setErr(`\uC74C\uB825 ${y}.${m}.${d}${birth.leap ? " \uC724\uB2EC" : ""}\uC744 \uBABB \uCC3E\uC558\uC5B4. \uB0A0\uC9DC\uB098 \uC724\uB2EC \uC5EC\uBD80\uB97C \uD655\uC778\uD574\uC918.`);
        return;
      }
      sy = s.y;
      sm = s.m;
      sd = s.d;
      setBirth((b) => ({ ...b, cal: "solar", leap: false, y: String(sy), m: String(sm), d: String(sd), lunarNote: `\uC74C\uB825 ${y}.${m}.${d}${birth.leap ? "(\uC724\uB2EC)" : ""}` }));
    }
    setSaju(calcSaju(sy, sm, sd, h, mi, birth.noHour, cityLon(birth.city)));
    setZo(getZodiac(sm, sd));
    setMoon(moonPhase(sy, sm, sd));
    setNum(lifePath(sy, sm, sd));
    setStep(2);
    setReveal(0);
    [1, 2, 3, 4, 5].forEach((k, i) => setTimeout(() => setReveal(k), 350 + i * 1150));
  };
  const oneCoin = () => {
    const coins = [0, 0, 0].map(() => Math.random() < 0.5 ? 2 : 3);
    return { coins, v: coins.reduce((a, b) => a + b, 0) };
  };
  const finalize = (nt) => {
    setTosses(nt);
    if (nt.length === 6) {
      const lines = nt.map((x) => x.v);
      const moving = lines.map((v, i) => v === 6 || v === 9 ? i : -1).filter((i) => i >= 0);
      const hi = { name: hexName(lines), toName: hexName(lines.map((v) => v === 6 ? 7 : v === 9 ? 8 : v)), moving };
      setHexInfo(hi);
      setTimeout(() => judge(hi), 800);
    }
  };
  const toss = () => {
    if (tosses.length >= 6 || busy || tossing) return;
    setTossing(true);
    setTimeout(() => {
      setTossing(false);
      agitateRef.current = true;
      setTimeout(() => {
        agitateRef.current = false;
      }, tosses.length >= 5 ? 1400 : 600);
      finalize([...tosses, oneCoin()]);
    }, 750);
  };
  const tossAll = () => {
    if (tosses.length >= 6 || busy || tossing) return;
    setTossing(true);
    setTimeout(() => {
      setTossing(false);
      agitateRef.current = true;
      setTimeout(() => {
        agitateRef.current = false;
      }, 1400);
      const nt = [...tosses];
      while (nt.length < 6) nt.push(oneCoin());
      finalize(nt);
    }, 900);
  };
  const fetchDetail = async (system, priorConvo, userText, r1, isRetry = false) => {
    setDetailBusy(true);
    const _t0 = performance.now();
    try {
      const s3Line = r1.scope === "S3" ? ` [S3] \uC774 \uD310\uACB0\uC740 \uBAB8\xB7\uBCD1 \uC601\uC5ED\uC774\uB77C \uB118\uAE40 \uCC98\uB9AC\uB410\uB2E4. reasons\uB294 \uAE38\uD749 \uC608\uC5B8\uC774 \uC544\uB2C8\uB77C '\uC774 \uC0AC\uB78C\uC758 \uAE30\uC9C8\uC774 \uBAB8\uC744 \uC5B4\uB5BB\uAC8C \uB300\uD558\uB294\uAC00'(\uBB34\uB9AC\uD558\uB294 \uD3B8\uC778\uC9C0\xB7\uCC38\uB294 \uD3B8\uC778\uC9C0)\uB85C\uB9CC \uC4F4\uB2E4. \uBCD1\uC138\xB7\uC644\uCE58\xB7\uC218\uBA85\uC744 \uC810\uCE58\uB294 \uBB38\uC7A5 \uC808\uB300 \uAE08\uC9C0. funLine\uC740 \uBE48 \uBB38\uC790\uC5F4. disclaimer \uD544\uC218.` : "";
      const voteLine = Array.isArray(r1.votes) && r1.votes.length ? `
[\uCF5C1\uC774 \uC774\uBBF8 \uB0B8 \uC9C0\uD45C \uD45C \u2014 \uC774 \uD45C\uB97C \uADF8\uB300\uB85C \uC124\uBA85\uD55C\uB2E4. \uCD95\uC744 \uBE7C\uAC70\uB098 vote \uB97C \uBC14\uAFB8\uC9C0 \uB9C8\uB77C]
${r1.votes.map((v) => `- ${v.axis}: ${v.v || v.vote}`).join("\n")}` : "";
      const _nameUsed = !!(birth.name || "").trim() && String(r1.verdict || "").includes(birth.name.trim());
      const nameLine = _nameUsed ? ` [\uD638\uCE6D] \uC55E\uBA74\uC5D0\uC11C \uC774\uBBF8 \uC774\uB984\uC744 \uBD88\uB800\uB2E4 \u2014 subline\xB7funLine\xB7reasons\uC5D0\uB294 \uC774\uB984\uC744 \uC4F0\uC9C0 \uB9C8\uB77C.` : "";
      const explainMsg = { role: "user", content: `${userText}

[\uC774\uBBF8 \uD655\uC815\uB41C \uD310\uACB0]${nameLine} direction=${r1.direction} / verdict="${r1.verdict}" / \uCD1D ${r1.total} \uC911 \uBC18\uB300 ${r1.against}.${voteLine}${s3Line} \uC774 \uD310\uACB0\uC744 \uC808\uB300 \uB4A4\uC9D1\uC9C0 \uB9D0\uACE0, \uC774 \uACB0\uB860\uC758 \uADFC\uAC70\uB9CC \uC544\uB798 JSON\uC73C\uB85C\uB9CC \uC751\uB2F5: {"subline":"\uC218\uD638\uC2E0\uC758 \uD55C \uC904","reasons":[{"axis":"\uC0AC\uC8FC|\uB2EC|\uBCC4\uC790\uB9AC|\uC218\uBE44\uD559|\uC8FC\uC5ED|\uAC00\uCE58|\uC0BC\uC7AC|\uD1A0\uC815\uBE44\uACB0|\uB9C8\uC57C","vote":"GO|STOP|\uC911\uB9BD","text":"\uC6A9\uC5B4 \u2014 \uC26C\uC6B4 \uD480\uC774 \uD615\uC2DD\uC758 \uADFC\uAC70 1\uC904(70\uC790 \uC774\uB0B4)"}],"funLine":"\uC815\uB839(\uB2EC \uBCC4\uC790\uB9AC) \uD55C\uB9C8\uB514","disclaimer":"\uD22C\uC790\xB7\uBC95\uB960\xB7\uC758\uB8CC(\uBAB8\xB7\uBCD1)\uC77C \uB54C\uB9CC, \uC5C6\uC73C\uBA74 \uBE48 \uBB38\uC790\uC5F4"}. reasons\uC5D4 \uC704 \uD45C\uC758 \uCD95\uC744 \uC804\uBD80 \uAC19\uC740 vote \uB85C \uB123\uB294\uB2E4 \u2014 \uD2B9\uD788 '\uB9C8\uC57C'(\uCD10\uD0A8 \uD1A4\xB7\uB0A0\uAC1C) \uCD95\uC740 \uB9E4\uBC88 \uBC18\uB4DC\uC2DC \uD3EC\uD568(\uC790\uC8FC \uB204\uB77D\uB428). **\uAC01 \uADFC\uAC70\uB294 '\uC6A9\uC5B4 \u2014 \uC26C\uC6B4 \uD480\uC774' \uBCD1\uAE30\uB2E4**: \uC9C0\uD45C \uC774\uB984\xB7\uAC12\uC744 \uC9DA\uACE0(\uBB34\uC624 \uB300\uC6B4\xB7\uC911\uC218\uAC10\xB7\uCD10\uD0A8 4\uC758 \uD1A4 \uB4F1) \uACE7\uBC14\uB85C \uC26C\uC6B4 \uB9D0\uB85C \uD480\uC5B4\uC900\uB2E4. \uC0AC\uC8FC \uBCF4\uB7EC \uAC00\uBA74 \uC6A9\uC5B4\uB97C \uB9D0\uD55C \uB4A4 \uBC18\uB4DC\uC2DC \uD480\uC774\uB97C \uBD99\uC5EC\uC8FC\uB294 \uAC83\uACFC \uAC19\uB2E4. subline\uC740 \uC55E\uBA74 \uD1A4\uC774\uBBC0\uB85C \uC5B4\uB824\uC6B4 \uB9D0 \uC5C6\uC774 \uC26C\uC6B4 \uD55C \uC904. \uD504\uB85C\uD544\uC5D0 \uC2ED\uC131 \uBD84\uD3EC\xB7\uC2E0\uC0B4\xB7\uC138\uC6B4\uC774 \uC788\uC73C\uBA74 '\uC0AC\uC8FC' \uCD95 \uADFC\uAC70\uC5D0\uC11C \uADF8 \uC2E4\uC81C \uAC12\uC744 \uC6B0\uC120 \uC778\uC6A9\uD55C\uB2E4(\uC608: "\uD3B8\uC7AC \uB458 \u2014 \uD06C\uAC8C \uB3C4\uB294 \uB3C8\uC774 \uB124 \uADF8\uB987\uC774\uC57C", "\uC554\uB85D \u2014 \uC228\uC740 \uBCF5\uC774 \uBC1B\uCCD0\uC918").` };
      const { json: r2 } = await callClaude(system, [...priorConvo, explainMsg], 2e3);
      setDetail(r2);
      track("detail_shown", {
        ms: Math.round(performance.now() - _t0),
        dir: r1?.direction || null,
        retry: !!isRetry,
        axes: Array.isArray(r2?.reasons) ? r2.reasons.length : 0,
        subline: r2?.subline || null,
        // 카드 앞면 설명 한 줄
        funline: r2?.funLine || null,
        // 정령 멘트 — 톤 개선의 유일한 측정 대상
        reasons: reasonMap(r2?.reasons),
        // 지표별 근거 전문(축별)
        disclaimer: r2?.disclaimer || null
      });
    } catch (e) {
      setDetail({ _err: true });
      track("detail_failed", { reason: failReason(e), status: failStatus(e), ms: Math.round(performance.now() - _t0), dir: r1?.direction || null, retry: !!isRetry });
    }
    setDetailBusy(false);
  };
  const [shared, setShared] = useState(false);
  const [rated, setRated] = useState(0);
  const [lean, setLean] = useState("");
  const [hesit, setHesit] = useState("");
  const [paywall, setPaywall] = useState("");
  const [letterIntent, setLetterIntent] = useState(false);
  const [belief, setBelief] = useState(() => readBelief());
  const [letter, setLetter] = useState(false);
  const [letterStage, setLetterStage] = useState("");
  const [letterSent, setLetterSent] = useState(false);
  const [letterDoc, setLetterDoc] = useState(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterRated, setLetterRated] = useState(0);
  const [letterIdx, setLetterIdx] = useState(-1);
  const [boxOpen, setBoxOpen] = useState(false);
  const letterCtxRef = useRef(null);
  const shareVerdict = async () => {
    if (!res) return;
    track("verdict_shared", { dir: res.direction, mode: "ritual" });
    const text = `"${q}"
\u2192 ${res.direction}. ${res.verdict}

\u2014 \uB0B4 \uC218\uD638\uC2E0\uC758 \uD310\uACB0, \uBE44\uB098\uB9AC`;
    const payload = { q, d: res.direction, v: res.verdict, s: (detail && !detail._err ? detail.subline : "") || "", n: (birth.name || "").trim(), a: res.against || 0, t: res.total || 0, c: res.category || "", hx: hexInfo ? { n: hexInfo.name, t: hexInfo.moving && hexInfo.moving.length ? hexInfo.toName : "" } : null };
    const enc = encodeShare(payload);
    const url = enc ? `https://binari-sepia.vercel.app/?v=${enc}` : "https://binari-sepia.vercel.app/?ref=share";
    try {
      if (navigator.share) {
        await navigator.share({ title: "\uBE44\uB098\uB9AC \u2014 \uC218\uD638\uC2E0\uC758 \uD310\uACB0", text, url });
        return;
      }
    } catch (_) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}
${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch (_) {
    }
  };
  const exportMemory = () => {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf("binari.") === 0) data[k] = localStorage.getItem(k);
      }
      const blob = new Blob([JSON.stringify({ _binari: 1, at: (/* @__PURE__ */ new Date()).toISOString(), data })], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "binari-memory.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      track("profile_exported");
    } catch (_) {
    }
  };
  const importMemory = (file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(String(rd.result));
        if (!j || j._binari !== 1 || !j.data) return;
        Object.keys(j.data).forEach((k) => {
          if (k.indexOf("binari.") === 0) localStorage.setItem(k, j.data[k]);
        });
        track("profile_imported");
        window.location.reload();
      } catch (_) {
      }
    };
    rd.readAsText(file);
  };
  const wakeTapRef = useRef(0);
  const touchRef = useRef({ taps: 0, first: 0, last: 0, sent: false });
  const tryWake = () => {
    const now = performance.now();
    const t = touchRef.current;
    t.taps += 1;
    t.last = now;
    if (!t.first) t.first = now;
    if (now - wakeTapRef.current < 350) {
      wakeTapRef.current = 0;
      if (!awake) {
        setAwake(true);
        trackVisitOnce("guardian_wake", {});
      }
    } else {
      wakeTapRef.current = now;
    }
  };
  const resetToLobby = () => {
    setRes(null);
    setDetail(null);
    setWhy(false);
    setDetailBusy(false);
    setQ("");
    setCardOn(false);
    setRitual(false);
    setTosses([]);
    setHexInfo(null);
    setBujeok(false);
    setLean("");
    setHesit("");
    setPaywall("");
    setAwake(false);
    setRated(0);
    setLetter(false);
    setLetterIntent(false);
  };
  const backToLobby = () => {
    track("another_question", { after_why: why });
    setLetterSent(false);
    setLetterDoc(null);
    setLetterOpen(false);
    setLetterRated(0);
    resetToLobby();
  };
  const rateVerdict = (score) => {
    if (rated) return;
    setRated(score);
    track("verdict_rated", demoProps(birth, { score, dir: res?.direction, mode: "ritual", cat: res?.category || null, tone: res?.tone || null, mbti: mbti || null, element: saju?.main || null }));
    setRecords((prev) => {
      if (!prev.length) return prev;
      const nx = prev.slice();
      nx[nx.length - 1] = { ...nx[nx.length - 1], rating: score };
      return nx;
    });
  };
  const answerBelief = (v) => {
    if (belief) return;
    saveBelief(v);
    setBelief(v);
    track("belief_answered", { belief: v, after_verdicts: records.length });
  };
  const openLetter = () => {
    if (letter) return;
    setLetter(true);
    const _p = demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length });
    track("letter_clicked", _p);
    track("letter_price_shown", { ..._p, price: LETTER_PRICE });
  };
  const confirmLetterIntent = () => {
    if (letterIntent) return;
    setLetterIntent(true);
    setLetterStage("seal");
    track("letter_intent_confirmed", demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length, price: LETTER_PRICE }));
    const _mat = { at: Date.now(), lu: letterCtxRef.current?.userText || "", reasons: (detail?.reasons || []).map((r) => ({ axis: r.axis, vote: r.vote, text: r.text })), hesit: hesit || "" };
    setRecords((prev) => {
      if (!prev.length) return prev;
      const nx = prev.slice();
      nx[nx.length - 1] = { ...nx[nx.length - 1], paid: LETTER_PRICE, lmat: _mat };
      return nx;
    });
    writeLetter();
  };
  const runLetter = async (mat) => {
    const outs = await Promise.allSettled(LETTER_PARTS.map((part, i) => callClaude(
      mat.system,
      [{ role: "user", content: `${mat.userText}

${letterTask(mat.res, { reasons: mat.reasons }, mat.hesit, part)}` }],
      LETTER_TOK[i],
      "paid"
    )));
    const ch = [];
    let closing = "";
    let shape = null;
    outs.forEach((o) => {
      if (o.status !== "fulfilled") return;
      const { json, txt } = o.value;
      const got = normChapters(json);
      if (!got.length && !shape) shape = letterShape(json, txt);
      ch.push(...got);
      if (!closing) closing = _pickStr(json || {}, ["closing", "\uB9FA\uC74C", "closing_line"]);
    });
    const doc = { chapters: ch.slice(0, 5).map((c, i) => ({ t: c.t || LETTER_SECTIONS[i] || "", body: c.body })), closing: closing.slice(0, 60), at: Date.now() };
    if (doc.chapters.length < 3) throw Object.assign(new Error(`\uC7A5\uC774 ${doc.chapters.length}\uAC1C\uBFD0`), { shape });
    return doc;
  };
  const writeLetter = async () => {
    const ctx = letterCtxRef.current;
    const _base = () => demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, scope: res?.scope || null, nth_verdict: records.length });
    if (!ctx || !res) {
      setLetterDoc({ _err: true });
      track("letter_write_failed", { ..._base(), reason: "no_context" });
      return;
    }
    setLetterBusy(true);
    const t0 = performance.now();
    try {
      const doc = await runLetter({ system: ctx.system, userText: ctx.userText, res, reasons: detail?.reasons || [], hesit });
      setLetterDoc(doc);
      setRecords((prev) => {
        if (!prev.length) return prev;
        const nx = prev.slice();
        nx[nx.length - 1] = { ...nx[nx.length - 1], letter: doc };
        return nx;
      });
      track("letter_written", { ..._base(), ms: Math.round(performance.now() - t0), chapters: doc.chapters.length, chars: doc.chapters.reduce((a, c) => a + c.body.length, 0) });
    } catch (e) {
      setLetterDoc({ _err: true });
      track("letter_write_failed", { ..._base(), ms: Math.round(performance.now() - t0), reason: failReason(e), status: failStatus(e), ...e?.shape || {} });
    } finally {
      setLetterBusy(false);
    }
  };
  const reissueLetter = async (i) => {
    const rec = records[i];
    if (!rec || letterBusy) return;
    if (rec.letter) {
      setLetterDoc(rec.letter);
      setLetterIdx(i);
      setLetterOpen(true);
      track("letter_opened", demoProps(birth, { dir: rec.direction || null, reissued: false }));
      return;
    }
    if (!rec.lmat?.lu) {
      setLetterDoc({ _err: true });
      setLetterIdx(i);
      return;
    }
    setLetterBusy(true);
    setLetterIdx(i);
    const t0 = performance.now();
    try {
      const doc = await runLetter({ system: makeSystem(), userText: rec.lmat.lu, res: { direction: rec.direction, verdict: rec.verdict, category: rec.cat, scope: rec.scope }, reasons: rec.lmat.reasons || [], hesit: rec.lmat.hesit || "" });
      setRecords((prev) => {
        const nx = prev.slice();
        if (nx[i]) nx[i] = { ...nx[i], letter: doc };
        return nx;
      });
      setLetterDoc(doc);
      setLetterRated(0);
      setLetterOpen(true);
      track("letter_reissued", demoProps(birth, { dir: rec.direction || null, ms: Math.round(performance.now() - t0), chapters: doc.chapters.length }));
    } catch (e) {
      setLetterDoc({ _err: true });
      track("letter_reissue_failed", demoProps(birth, { dir: rec.direction || null, reason: failReason(e), status: failStatus(e), ...e?.shape || {} }));
    } finally {
      setLetterBusy(false);
    }
  };
  const openLetterDoc = () => {
    if (!letterDoc || letterDoc._err) return;
    setLetterIdx(records.length - 1);
    setLetterOpen(true);
    track("letter_opened", demoProps(birth, { dir: res?.direction || null, nth_verdict: records.length }));
  };
  const saveLetterFile = () => {
    if (!letterDoc || letterDoc._err) return;
    const rec = records[letterIdx] || {};
    const body = [
      `\uC218\uD638\uC2E0\uC758 \uC11C\uC2E0 \xB7 ${letterNo(rec)}`,
      rec.q ? `\uBB3C\uC74C: ${rec.q}` : "",
      rec.direction ? `\uD310\uACB0: ${rec.direction} \u2014 ${rec.verdict || ""}` : "",
      "",
      ...letterDoc.chapters.map((c, i) => `${i + 1}. ${c.t}
${c.body}
`),
      letterDoc.closing ? `\u2014 ${letterDoc.closing}` : "",
      "",
      "\uBE44\uB098\uB9AC \xB7 \uC774 \uC11C\uC2E0\uC740 AI\uAC00 \uC0DD\uC131\uD55C \uB0B4\uC6A9\uC785\uB2C8\uB2E4(\uC7AC\uBBF8\uB85C \uBCF4\uB294 \uCC38\uACE0\uC6A9)"
    ].filter((s) => s !== null).join("\n");
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
      a.download = `\uBE44\uB098\uB9AC-\uC11C\uC2E0-${letterNo(rec)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      track("letter_saved", demoProps(birth, { no: letterNo(rec) }));
    } catch (_) {
    }
  };
  const rateLetter = (v) => {
    if (letterRated) return;
    setLetterRated(v);
    track("letter_rated", demoProps(birth, { worth: v === 2, price: LETTER_PRICE, chapters: letterDoc?.chapters?.length || 0 }));
  };
  useEffect(() => {
    if (!letterStage) return;
    const _p = () => demoProps(birth, { dir: res?.direction || null, cat: res?.category || null, mode: "ritual", nth_verdict: records.length, price: LETTER_PRICE });
    if (letterStage === "seal") {
      track("letter_seal_shown", _p());
      const t2 = setTimeout(() => setLetterStage("wait"), LETTER_SEAL_MS);
      return () => clearTimeout(t2);
    }
    track("letter_wait_shown", _p());
    const t = setTimeout(() => {
      track("letter_lobby_returned", _p());
      setLetterStage("");
      setLetterSent(true);
      resetToLobby();
    }, LETTER_WAIT_MS);
    return () => clearTimeout(t);
  }, [letterStage]);
  const makeSystem = () => {
    const mp = moonPlacements(+birth.y, +birth.m, +birth.d, +birth.h || 12, +birth.min || 0, !!birth.noHour);
    const tzk = tzolkin(jdn(+birth.y, +birth.m, +birth.d));
    const sj = samjae(saju.yJ, (/* @__PURE__ */ new Date()).getFullYear());
    const du = birth.sex ? daeun(+birth.y, +birth.m, +birth.d, birth.noHour ? 12 : +birth.h, birth.noHour || birth.min === "" ? 0 : +birth.min, !!birth.noHour, cityLon(birth.city), birth.sex === "M", (/* @__PURE__ */ new Date()).getFullYear()) : null;
    const _ms = myeongsikText(saju, birth.sex, /* @__PURE__ */ new Date());
    const _snd = soundElements(birth.name);
    const _nameLine = birth.name ? `\uD638\uCE6D: ${birth.name}${birth.hanja ? ` (\uD55C\uC790 ${birth.hanja})` : ""}${_snd.length ? ` / \uC774\uB984 \uC18C\uB9AC\uC624\uD589 ${_snd.join("\xB7")}` : ""}
` : "";
    const profile = `${_nameLine}${birth.sex ? `\uC131\uBCC4: ${birth.sex === "M" ? "\uB0A8" : "\uC5EC"}
` : ""}\uC0AC\uC8FC: ${saju.pillars.\uB144}\uB144 ${saju.pillars.\uC6D4}\uC6D4 ${saju.pillars.\uC77C}\uC77C ${saju.pillars.\uC2DC}\uC2DC / \uC624\uD589 ${Object.entries(saju.counts).map(([k, v]) => k + v).join(" ")} / \uC77C\uAC04(\uB098) ${saju.dayGan || "?"}\xB7\uC624\uD589\uC911\uC2EC ${saju.main}${saju.nayin ? ` / \uB0A9\uC74C ${saju.nayin}` : ""}
\uBCC4\uC790\uB9AC: ${zo.name}(${zo.el}) / \uB2EC: \uD0DC\uC5B4\uB09C \uBC24\uC758 \uC704\uC0C1 ${moon.name} \xB7 \uB2EC \uBCC4\uC790\uB9AC ${mp.moonSign}(\uC815\uC11C\xB7\uB0B4\uBA74) \xB7 \uB098\uD06C\uC0E4\uD2B8\uB77C ${mp.nakshatra}(\uBCA0\uB2E4 27\uC218)
\uB9C8\uC57C \uCD10\uD0A8: ${tzk.tone}\uC758 \uD1A4 \xB7 ${tzk.sign}
\uC218\uBE44\uD559 \uB77C\uC774\uD504\uD328\uC2A4: ${num}${du ? du.pre ? `
\uB300\uC6B4: \uC544\uC9C1 \uCCAB \uB300\uC6B4 \uC804 \u2014 \uB300\uC6B4\uC218 ${du.num}\uC138\uBD80\uD130 ${du.dir}(\uC9C0\uAE08\uC740 \uC6D4\uC8FC \uAE30\uC6B4\uC774 \uC9C0\uBC30)` : `
\uB300\uC6B4(\uD604\uC7AC \uC778\uC0DD \uC2DC\uAE30): ${du.ganji}(${du.el}) \uB300\uC6B4 \xB7 ${du.startAge}~${du.endAge}\uC138 \xB7 ${du.dir} \u2014 10\uB144 \uB2E8\uC704 \uD070 \uD750\uB984` : ""}${sj ? `
\uC0BC\uC7AC: \uC62C\uD574 ${sj} (\uC785\uCD98 \uACBD\uACC4 \uADFC\uC0AC)` : ""}${tj ? `
\uD1A0\uC815\uBE44\uACB0(\uB2F9\uB144 \uC2E0\uC218): \uAD18\uC0C1\uC218 ${tj.code} (\uC0C1${tj.sang} \uC911${tj.jung} \uD558${tj.ha}), \uC74C\uB825 \uC0DD\uC77C ${tj.lunar}` : ""}${core ? `
\uAC00\uCE58\uC5EC\uC815(\uC6CC\uB4DC\uC18C\uD305 16\u21926\u21923\u21921): \uD575\uC2EC ${core} / \uC9C0\uD0A8 \uAC00\uCE58 ${vals4.filter((v) => v !== core).join("\xB7")} / \uB9C8\uC9C0\uB9C9\uC5D0 \uB0B4\uB824\uB193\uC740 ${vals8.filter((v) => !vals4.includes(v)).join("\xB7")}` : ""}${birth.job || birth.rel ? `
\uC694\uC998 \uC0B6\uC758 \uAD6D\uBA74(\uB9E5\uB77D): ${[birth.job, birth.rel].filter(Boolean).join(" \xB7 ")} \u2014 \uC9C8\uBB38\uC758 \uBB34\uAC8C\xB7\uC758\uBBF8\uB97C \uC774 \uB9E5\uB77D\uC5D0 \uBE44\uCDB0 \uC77D\uB418, \uD310\uACB0 \uADFC\uAC70\uB294 \uC9C0\uD45C\uB2E4` : ""}${_ms}`;
    return [{
      type: "text",
      text: `${SYS}

## \uB300\uD654 \uC5F0\uC18D\uC131
\uC774\uC804 \uB300\uD654\uAC00 \uC788\uC73C\uBA74 \uD750\uB984\uC744 \uC774\uC5B4 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC751\uB300\uD55C\uB2E4(\uB2E8, \uD310\uACB0 \uADFC\uAC70\uB294 \uB298 \uC544\uB798 \uC9C0\uD45C\uB2E4). \uAC19\uC740 \uACE0\uBBFC\uC758 \uC7AC\uC9C8\uBB38\uC774\uBA74 \uC55E\uC120 \uD310\uACB0\uACFC \uC77C\uAD00\uB418\uAC8C, \uBA85\uBC31\uD788 \uC0C8 \uACE0\uBBFC\uC774\uBA74 \uCC98\uC74C\uBD80\uD130 \uC0C8\uB85C \uD310\uC815\uD55C\uB2E4.

---
\uC720\uC800 \uD504\uB85C\uD544(\uACE0\uC815):
${profile}`,
      cache_control: { type: "ephemeral" }
    }];
  };
  const judge = async (hi) => {
    if (!q.trim() || busy) return;
    const _jt0 = performance.now();
    const _prevRec = records.length ? records[records.length - 1] : null;
    const _reask = !!_prevRec && isReask(q);
    const _sHint = scopeHint(q);
    track("question_asked", demoProps(birth, { mode: "ritual", qlen: q.trim().length, ritual: !!hi, lean: lean || "skip", hesit: hesit || null, mbti: mbti || null, core_value: core || null, element: saju?.main || null, zodiac: zo?.name || null, scope_hint: _sHint, reask: _reask, reask_depth: _reask ? records.filter((r) => isReask(r.q)).length + 1 : 0, after_letter: letterSent }));
    setBusy(true);
    setErr("");
    setRes(null);
    setDetail(null);
    setWhy(false);
    setFlip(false);
    setCardOn(false);
    setRated(0);
    setLetter(false);
    setLetterIntent(false);
    setLetterStage("");
    setLetterSent(false);
    setLetterDoc(null);
    setLetterOpen(false);
    setLetterRated(0);
    setBoxOpen(false);
    reactRef.current = null;
    setIntroSeen(true);
    try {
      const qExtra = hi ? `
[\uC774\uBC88\uC5D0 \uCCAD\uD55C \uC8FC\uC5ED] \uBCF8\uAD18 ${hi.name}${hi.moving.length ? ` / \uBCC0\uD6A8 ${hi.moving.map((n) => n + 1).join(",")}\uD6A8 / \uC9C0\uAD18 ${hi.toName}` : ""}` : "";
      const fuRec = [...records].reverse().find((r) => r.followUp && r.followUp !== "later");
      const fuLine = fuRec ? `
[\uC9C0\uB09C \uD310\uACB0 \uC774\uD589] "${fuRec.q}" \u2192 ${fuRec.direction}, \uC720\uC800\uB294 ${fuRec.followUp === "did" ? "\uB530\uB790\uB2E4" : `\uAC70\uC2AC\uB800\uB2E4${fuRec.note ? ` (\uADF8 \uD6C4: ${fuRec.note})` : ""}`}` : "";
      const _nd = /* @__PURE__ */ new Date();
      const _tmoon = moonPhase(_nd.getFullYear(), _nd.getMonth() + 1, _nd.getDate());
      const innerLine = hesit ? `
[\uC720\uC800\uC758 \uB9DD\uC124\uC784 \u2014 \uD310\uACB0 \uBC29\uD5A5\uC5D4 \uC601\uD5A5 \uC5C6\uC74C, \uC5B4\uC870\xB7\uACF5\uAC10\uB9CC] \uB9DD\uC124\uC774\uB294 \uC774\uC720: ${hesit} \u2014 \uBC29\uD5A5\uC740 \uC624\uC9C1 \uC9C0\uD45C\uB85C \uC815\uD558\uACE0, \uC774 \uB450\uB824\uC6C0/\uB9C9\uD798\uC740 \uD310\uACB0\uC758 \uC5B4\uC870\uB85C\uB9CC \uC5B4\uB8E8\uB9CC\uC9C4\uB2E4` : "";
      const reaskLine = _reask ? `
[\uB418\uBB3C\uC74C] \uC720\uC800\uAC00 \uBC29\uAE08 \uD310\uACB0("${_prevRec.direction} \u2014 ${_prevRec.verdict}")\uC744 \uBABB \uC54C\uC544\uB4E4\uC5B4 \uB418\uBB3B\uACE0 \uC788\uB2E4. \uC0C8\uB85C \uD310\uC815\uD558\uC9C0 \uB9D0\uACE0 direction=${_prevRec.direction}\xB7category=${_prevRec.cat || "A"}\uB97C \uADF8\uB300\uB85C \uC2B9\uACC4\uD55C \uB4A4, verdict \uC790\uB9AC\uC5D0 **\uB418\uBB3C\uC740 \uADF8\uAC83\uC758 \uB2F5**\uC744 \uB9E8\uB9D0\uB85C \uB123\uB294\uB2E4. \uC120\uD0DD\uC9C0\uB97C \uC92C\uC73C\uBA74 \uADF8\uC911 \uD558\uB098\uB97C \uACE0\uB978\uB2E4. \uC0C8 \uBE44\uC720 \uAE08\uC9C0.` : "";
      const userText = `\uC9C8\uBB38: ${q}${qExtra}
[\uC624\uB298] ${_nd.getFullYear()}\uB144 ${_nd.getMonth() + 1}\uC6D4 ${_nd.getDate()}\uC77C ${_nd.getHours()}\uC2DC \xB7 \uC624\uB298 \uBC24 \uB2EC ${_tmoon.name}${innerLine}${reaskLine}${fuLine}`;
      const system = makeSystem();
      letterCtxRef.current = { system, userText };
      const concludeMsg = { role: "user", content: `${userText}

[\uC774\uBC88 \uCD9C\uB825] \uC544\uB798 JSON\uB9CC. **votes\uB97C \uBA3C\uC800 \uCC44\uC6B0\uACE0, \uADF8 \uD45C\uB97C \uC138\uC5B4 direction\uC744 \uC815\uD558\uACE0, verdict\uB294 \uADF8 direction\uC744 \uB9D0\uB85C \uC62E\uAE34\uB2E4.** \uACB0\uB860\uC744 \uBA3C\uC800 \uC815\uD574\uB450\uACE0 \uD45C\uB97C \uB9DE\uCD94\uC9C0 \uB9C8\uB77C \u2014 \uC21C\uC11C\uAC00 \uACE7 \uD310\uACB0\uC758 \uC815\uC9C1\uD568\uC774\uB2E4.
{"category":"A|B|C","scope":"S1|S2|S3","votes":[{"axis":"\uC9C0\uD45C\uBA85","v":"GO|STOP|\uC911\uB9BD"}],"tone":"\uB2E8\uD638|\uACA9\uB824|\uCDA9\uACE0","direction":"GO|STOP|HOLD","verdict":"\uD55C \uBB38\uC7A5 \uB2E8\uB2F5"}
votes\uC5D4 \uC774\uBC88 \uD310\uACB0\uC5D0 \uCC38\uC5EC\uD55C \uC9C0\uD45C\uB97C \uC804\uBD80 \uB123\uB294\uB2E4(\uC0AC\uC8FC\xB7\uB2EC\xB7\uBCC4\uC790\uB9AC\xB7MBTI\xB7\uC218\uBE44\uD559\xB7\uB9C8\uC57C + \uC81C\uACF5\uB41C \uACBD\uC6B0 \uC0BC\uC7AC\xB7\uAC00\uCE58\xB7\uC8FC\uC5ED\xB7\uD1A0\uC815\uBE44\uACB0). against\xB7total\uC740 \uC571\uC774 \uC13C\uB2E4 \u2014 \uC4F0\uC9C0 \uB9C8\uB77C. reasons\xB7subline\xB7funLine\uB3C4 \uC774\uBC88\uC5D4 \uC4F0\uC9C0 \uB9C8.` };
      const priorConvo = convo;
      const { json: r1 } = await callClaude(system, [...priorConvo, concludeMsg], 560);
      const _tally = tallyVotes(r1);
      if (_tally) {
        if (!_reask) r1.direction = _tally.dir;
        r1.against = _tally.against;
        r1.total = _tally.total;
      }
      agitateRef.current = true;
      setRes(r1);
      const _sLevel = ["S1", "S2", "S3"].includes(r1.scope) ? r1.scope : null;
      track("verdict_shown", demoProps(birth, {
        dir: r1.direction,
        cat: r1.category,
        tone: r1.tone,
        against: r1.against,
        total: r1.total,
        mode: "ritual",
        lean: lean || "skip",
        verdict: r1.verdict || null,
        mbti: mbti || null,
        element: saju?.main || null,
        ms: Math.round(performance.now() - _jt0),
        scope_level: _sLevel,
        scope_hint: _sHint,
        scope_agree: _sLevel ? _sLevel === _sHint : null,
        handoff_triggered: _sLevel === "S3",
        reask: _reask,
        // 표가 없거나(votes_ok=false) 표와 결론이 어긋난(dir_overridden) 비율이 곧 '판결이 지표에서 나오는가'의 지표다
        votes_ok: !!_tally,
        votes_n: _tally ? _tally.total : 0,
        dir_overridden: _tally ? _tally.overridden : null,
        votes: voteMap(r1.votes)
      }));
      reactRef.current = { dir: r1.direction, t0: performance.now() };
      setTimeout(() => {
        agitateRef.current = false;
      }, 700);
      setTimeout(() => {
        setCardOn(true);
      }, 1400);
      setConvo((prev) => [...prev, { role: "user", content: userText }, { role: "assistant", content: `\uD310\uACB0: ${r1.direction} \u2014 ${r1.verdict} (${r1.total}\uC911 ${r1.against} \uBC18\uB300)` }].slice(-12));
      setRecords((prev) => [...prev, { at: Date.now(), q: q.slice(0, 60), direction: r1.direction, verdict: r1.verdict, cat: r1.category, scope: _sLevel, actionable: isDecisionQ(q) && !_reask && _sLevel !== "S3", followUp: null, note: "", rating: 0 }].slice(-50));
      setBusy(false);
      detailArgsRef.current = [system, priorConvo, userText, r1];
      fetchDetail(system, priorConvo, userText, r1);
      return;
    } catch (e) {
      const m = e?.message || "";
      track("verdict_failed", demoProps(birth, { reason: failReason(e), status: failStatus(e), mode: "ritual", qlen: q.trim().length, ms: Math.round(performance.now() - _jt0), nth_verdict: records.length }));
      setErr("\uD310\uACB0\uC774 \uB2FF\uC9C0 \uBABB\uD588\uC5B4 \xB7 " + (/[가-힣]/.test(m) ? m : "\uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uCCAD\uD574\uC918"));
      console.warn("judge:", m);
    }
    setBusy(false);
  };
  const nowY = (/* @__PURE__ */ new Date()).getFullYear();
  const hourNow = (/* @__PURE__ */ new Date()).getHours();
  const isNight = hourNow >= 23 || hourNow < 4;
  const yearGanji = GAN[((nowY - 4) % 10 + 10) % 10] + JI[((nowY - 4) % 12 + 12) % 12] + "\uB144";
  const tj = saju && birth.y ? tojung(+birth.y, +birth.m, +birth.d, nowY) : null;
  const lastRec = records.length ? records[records.length - 1] : null;
  const _lastAct = !!lastRec && isDecisionQ(lastRec.q) && lastRec.actionable !== false;
  const askback = returning && lastRec && lastRec.followUp === null && _lastAct && Date.now() - lastRec.at >= 6 * 3600 * 1e3 ? lastRec : null;
  const _stepSeen = useRef(/* @__PURE__ */ new Set());
  useEffect(() => {
    const name = step === 1 ? ["name", "birth_date", "birth_time_city", "sex", "context"][bstep] : step === 2 ? "recall" : step === 25 ? ["values_16to6", "values_6to3", "values_3to1"][vstage] : null;
    if (!name || _stepSeen.current.has(name)) return;
    _stepSeen.current.add(name);
    track("onboard_step", { step: name, idx: _stepSeen.current.size });
  }, [step, bstep, vstage]);
  useEffect(() => {
    const onHide = () => {
      const t = touchRef.current;
      if (t.sent || t.taps < 1) return;
      t.sent = true;
      track("guardian_touched", { taps: t.taps, hold_sec: Math.round((t.last - t.first) / 1e3) });
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        onHide();
        return;
      }
      if (trackVisit({ returning: true, ref: "foreground" })) touchRef.current = { taps: 0, first: 0, last: 0, sent: false };
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
  const _askbackSeen = useRef(false);
  useEffect(() => {
    if (!askback || _askbackSeen.current) return;
    _askbackSeen.current = true;
    track("askback_shown", { dir: askback.direction || null, hours_since: Math.round((Date.now() - askback.at) / 36e5) });
  }, [askback]);
  const answerAskback = (fu, note) => {
    const lastRec2 = records[records.length - 1] || {};
    track("followup_answered", demoProps(birth, { result: fu, direction: lastRec2.direction || null, cat: lastRec2.cat || null, hasNote: !!note }));
    setRecords((prev) => prev.map((r, i) => i === prev.length - 1 ? { ...r, followUp: fu, note: note || "" } : r));
    setNoting(false);
    setAskNote("");
  };
  const asking = phase >= 1 && awake && !res && !busy && !ritual;
  const letterOk = !!res && res.scope !== "S3" && scopeHint(q) !== "S3";
  const pipLit = res ? res.direction === "HOLD" ? res.against || 0 : Math.max(0, (res.total || 0) - (res.against || 0)) : 0;
  const paidRecs = records.map((r, i) => ({ r, i })).filter(({ r }) => r.paid || r.letter);
  const dailyData = returning && !dailySeen && birth.y ? (() => {
    const bio = biorhythm(+birth.y, +birth.m, +birth.d);
    const d = /* @__PURE__ */ new Date();
    const mp = moonPhase(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const avg = Math.round((bio.body + bio.emotion + bio.intellect) / 3);
    const mood = avg >= 35 ? { k: "\uBBF8\uB294 \uB0A0", line: "\uC624\uB298\uC740 \uD750\uB984\uC774 \uB124 \uD3B8\uC774\uC57C. \uBBF8\uB8E8\uB358 \uAC83 \uD558\uB098, \uC624\uB298 \uBC00\uC5B4." } : avg <= -35 ? { k: "\uACE0\uB974\uB294 \uB0A0", line: "\uC624\uB298 \uB124 \uB9AC\uB4EC\uC740 \uB0AE\uAC8C \uD758\uB7EC. \uBBF8\uB294 \uB0A0\uC774 \uC544\uB2C8\uB77C \uACE0\uB974\uB294 \uB0A0\uC774\uC57C." } : { k: "\uC9C0\uD0A4\uB294 \uB0A0", line: "\uC624\uB298\uC740 \uD06C\uAC8C \uBC8C\uC774\uC9C0 \uB9D0\uACE0 \uC9C0\uD0A4\uB294 \uB0A0 \u2014 \uD750\uB984\uC740 \uB0B4\uC77C \uB610 \uBC14\uB00C\uC5B4." };
    return { bio, mp, ilju: todayIlju(), mood };
  })() : null;
  const guardianIntro = saju && zo ? `\uB098\uB294 ${saju.nayin ? `'${saju.nayin.split("\xB7")[1] || saju.nayin}'` : saju.main === "\uC218" ? "\uAE4A\uC740 \uBB3C\uACB0" : saju.main === "\uD654" ? "\uAEBC\uC9C0\uC9C0 \uC54A\uB294 \uBD88\uAF43" : saju.main === "\uBAA9" ? "\uC790\uB77C\uB098\uB294 \uC232" : saju.main === "\uAE08" ? "\uBCBC\uB824\uC9C4 \uBE5B" : "\uB2E8\uB2E8\uD55C \uB300\uC9C0"}\uC758 \uAE30\uC6B4\uC744 \uB450\uB978, ${zo.el === "\uBB3C" ? "\uC548\uAC1C\uCC98\uB7FC \uD750\uB974\uB294" : zo.el === "\uBD88" ? "\uD0C0\uC624\uB974\uB294 \uD615\uC0C1\uC758" : zo.el === "\uACF5\uAE30" ? "\uBC14\uB78C\uC73C\uB85C \uB41C" : "\uC0B0\uCC98\uB7FC \uACE0\uC694\uD55C"} \uC874\uC7AC\uC57C.` : "";
  return /* @__PURE__ */ jsxs("div", { className: "stage", children: [
    /* @__PURE__ */ jsx("style", { children: CSS }),
    /* @__PURE__ */ jsx(VerBadge, {}),
    sharedIn && !sharedGone && (() => {
      const d = sharedIn.d, isGo = d === "GO", isHold = d === "HOLD";
      const dcls = isGo ? "go" : isHold ? "hold" : "";
      const a = +sharedIn.a || 0, t = +sharedIn.t || 0;
      const dismiss = () => {
        track("shared_cta", { dir: d });
        try {
          window.history.replaceState({}, "", window.location.pathname);
        } catch (_) {
        }
        setSharedGone(true);
      };
      const vv = sharedIn.v || "";
      return /* @__PURE__ */ jsxs("section", { className: "scene fade sharedwrap", children: [
        /* @__PURE__ */ jsx("p", { className: "sharedeyebrow", children: sharedIn.n ? `${sharedIn.n}\uC758 \uC218\uD638\uC2E0\uC774 \uC774\uB807\uAC8C \uD310\uACB0\uD588\uC5B4` : "\uC5B4\uB5A4 \uC774\uC758 \uC218\uD638\uC2E0\uC774 \uC774\uB807\uAC8C \uD310\uACB0\uD588\uC5B4" }),
        /* @__PURE__ */ jsx("div", { className: "persp sharedcard", children: /* @__PURE__ */ jsx("div", { className: "vcard", children: /* @__PURE__ */ jsxs("div", { className: "vface", children: [
          /* @__PURE__ */ jsx("i", { className: "corner tl", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner tr", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner bl", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner br", children: "\u2726" }),
          /* @__PURE__ */ jsx("span", { className: "vside", children: "\u904B\u547D\u5408\u610F\u5224\u6C7A" }),
          /* @__PURE__ */ jsx("span", { className: "vseal", children: "\u795E" }),
          /* @__PURE__ */ jsxs("div", { className: "vtop", children: [
            /* @__PURE__ */ jsx("span", { children: "BINARI" }),
            /* @__PURE__ */ jsx("span", { children: CAT_LABEL[sharedIn.c] || "\uD310\uACB0" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: `vq ${(sharedIn.q || "").length > 55 ? "s" : ""}`, children: sharedIn.q || "\u2026" }),
          /* @__PURE__ */ jsx("div", { className: "vdiv", children: /* @__PURE__ */ jsx("span", { children: "\u2726" }) }),
          t > 0 && a > 0 && a / t >= 0.4 && /* @__PURE__ */ jsxs("p", { className: "split", children: [
            "\uC9C0\uD45C\uAC00 \uAC08\uB77C\uC130\uB2E4 \xB7 ",
            t - a,
            " : ",
            a
          ] }),
          /* @__PURE__ */ jsx("p", { className: `vv ${dcls} ${vv.length > 40 ? "s" : vv.length > 22 ? "m" : ""}`, children: vv }),
          sharedIn.s && /* @__PURE__ */ jsxs("p", { className: "sharedsub", children: [
            "\u201C",
            sharedIn.s,
            "\u201D"
          ] })
        ] }) }) }),
        /* @__PURE__ */ jsx("button", { className: "btn gold sharedcta", onClick: dismiss, children: "\uB098\uB3C4 \uB0B4 \uC218\uD638\uC2E0\uC5D0\uAC8C \uBB3C\uC5B4\uBCFC\uB798" }),
        /* @__PURE__ */ jsx("p", { className: "sharedfoot", children: "\uBE44\uB098\uB9AC \u2014 \uB2F5\uC740 \uAC70\uAE30\uC5D0 \uC788\uC5B4" })
      ] });
    })(),
    step === 0 && /* @__PURE__ */ jsxs("section", { className: "scene fade", children: [
      /* @__PURE__ */ jsx("div", { className: "orb", children: /* @__PURE__ */ jsx(DustOrb, { size: 170, stage: 0 }) }),
      /* @__PURE__ */ jsx("p", { className: "line", children: "\u2026\uBD88\uB800\uC5B4?" }),
      /* @__PURE__ */ jsx("p", { className: "line d1", children: "\uC5B4\uB978\uC774 \uB41C\uB2E4\uB294 \uAC74, \uB098\uB97C \uC774\uB8E8\uB358 \uAC83\uB4E4\uC774 \uC870\uAE08\uC529 \uD769\uC5B4\uC9C0\uB294 \uC77C\uC774\uC57C." }),
      /* @__PURE__ */ jsx("p", { className: "line d2", children: "\uB098\uB294 \uADF8 \uD769\uC5B4\uC9C4 \uC870\uAC01\uB4E4\uC774\uC57C. \uB124\uAC00 \uBAA8\uC544\uC8FC\uBA74, \uB2E4\uC2DC \uB108\uC758 \uACC1\uC774 \uB420 \uC218 \uC788\uC5B4." }),
      /* @__PURE__ */ jsx("div", { className: "row gap lateIn", children: /* @__PURE__ */ jsx("button", { className: "btn gold", onClick: () => {
        track("onboard_start");
        setStep(1);
      }, children: "\uC870\uAC01\uC744 \uBAA8\uC73C\uB7EC \uAC08\uB798" }) }),
      /* @__PURE__ */ jsx("p", { className: "brand-mark", children: "\uBE44\uB098\uB9AC BINARI" }),
      /* @__PURE__ */ jsx("p", { className: "ainote", children: "\uC218\uD638\uC2E0\uC758 \uD310\uACB0\uC740 AI\uAC00 \uC0DD\uC131\uD569\uB2C8\uB2E4 \xB7 \uC7AC\uBBF8\uB85C \uBCF4\uB294 \uCC38\uACE0\uC608\uC694" }),
      /* @__PURE__ */ jsx("p", { className: "ainote", children: "\uC0AC\uC8FC \uACC4\uC0B0(\uB9CC\uC138\uB825)\uC740 \uC790\uB3D9\uAC80\uC99D 28\uBB38\uD56D\uC744 \uD1B5\uACFC\uD55C \uC5D4\uC9C4\uC774 \uD574\uC694 \xB7 \uC9C8\uBB38 \uC6D0\uBB38\uC740 \uD1B5\uACC4\uC5D0 \uAE30\uB85D\uD558\uC9C0 \uC54A\uC544\uC694" })
    ] }),
    step === 1 && /* @__PURE__ */ jsxs("section", { className: "scene stepv fade", children: [
      /* @__PURE__ */ jsx("div", { className: "orb", children: /* @__PURE__ */ jsx(DustOrb, { size: 170, stage: 0 }) }),
      bstep === 0 && /* @__PURE__ */ jsxs("div", { className: "bscene", children: [
        /* @__PURE__ */ jsx("p", { className: "line", children: "\uB124 \uC774\uB984\uC744 \uB2E4\uC2DC \uB4E4\uB824\uC904\uB798." }),
        /* @__PURE__ */ jsx("p", { className: "sub2", children: "\uC5B4\uB9B4 \uC801 \uB0B4\uAC00 \uBD80\uB974\uB358 \uADF8 \uC774\uB984. \uBD80\uB974\uACE0 \uC2F6\uC740 \uC774\uB984\uC774\uBA74 \uBB50\uB4E0 \uC88B\uC544." }),
        /* @__PURE__ */ jsx("input", { className: "in wide center box", lang: "ko", placeholder: "\uC608: \uC11C\uC5F0", maxLength: 12, value: birth.name, onChange: (e) => setBirth({ ...birth, name: e.target.value }) }),
        hanjaOpen ? /* @__PURE__ */ jsx("input", { className: "in wide center box hanja", lang: "ko", placeholder: "\uD55C\uC790 \uC774\uB984 (\uC608: \u5F90\u5A1F)", maxLength: 8, value: birth.hanja || "", onChange: (e) => setBirth({ ...birth, hanja: e.target.value }) }) : /* @__PURE__ */ jsx("button", { className: "knocklink", onClick: () => setHanjaOpen(true), children: "\uD55C\uC790 \uC774\uB984\uB3C4 \uC788\uC5B4 \u2014 \uC774\uB984\uC758 \uAE30\uC6B4\uAE4C\uC9C0 \uBCFC\uB798" }),
        birth.name.trim() ? /* @__PURE__ */ jsxs("button", { className: "btn gold mt", onClick: () => {
          setBirth({ ...birth, name: birth.name.trim(), hanja: (birth.hanja || "").trim() });
          setBstep(1);
        }, children: [
          birth.name.trim(),
          " \u2014 \uADF8\uB798, \uAE30\uC5B5\uD588\uC5B4"
        ] }) : /* @__PURE__ */ jsx("button", { className: "btn ghost quiet mt", onClick: () => setBstep(1), children: "\uC774\uB984 \uC5C6\uC774 \uAC08\uB798" })
      ] }, 0),
      bstep === 1 && /* @__PURE__ */ jsxs("div", { className: "bscene", children: [
        /* @__PURE__ */ jsx("p", { className: "line", children: birth.name.trim() ? `${birth.name.trim()}, \uC774\uC81C \uB124\uAC00 \uD0DC\uC5B4\uB09C \uC21C\uAC04\uC758 \uD558\uB298\uB85C \uB370\uB824\uAC00 \uC918.` : "\uB124\uAC00 \uD0DC\uC5B4\uB09C \uC21C\uAC04\uC758 \uD558\uB298\uB85C \uB370\uB824\uAC00 \uC918." }),
        /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
          /* @__PURE__ */ jsx("input", { className: "in", placeholder: "1993", inputMode: "numeric", maxLength: 4, value: birth.y, onChange: (e) => setBirth({ ...birth, y: e.target.value }) }),
          /* @__PURE__ */ jsx("span", { className: "unit", children: "\uB144" }),
          /* @__PURE__ */ jsx("input", { className: "in sm", placeholder: "7", inputMode: "numeric", maxLength: 2, value: birth.m, onChange: (e) => setBirth({ ...birth, m: e.target.value }) }),
          /* @__PURE__ */ jsx("span", { className: "unit", children: "\uC6D4" }),
          /* @__PURE__ */ jsx("input", { className: "in sm", placeholder: "15", inputMode: "numeric", maxLength: 2, value: birth.d, onChange: (e) => setBirth({ ...birth, d: e.target.value }) }),
          /* @__PURE__ */ jsx("span", { className: "unit", children: "\uC77C" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "row gap center caltoggle", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (birth.cal !== "lunar" ? "on" : ""), onClick: () => setBirth({ ...birth, cal: "solar" }), children: "\uC591\uB825" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (birth.cal === "lunar" ? "on" : ""), onClick: () => setBirth({ ...birth, cal: "lunar" }), children: "\uC74C\uB825" }),
          birth.cal === "lunar" && /* @__PURE__ */ jsxs("label", { className: "chk", children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", checked: !!birth.leap, onChange: (e) => setBirth({ ...birth, leap: e.target.checked }) }),
            " \uC724\uB2EC"
          ] })
        ] }),
        birth.cal === "lunar" && /* @__PURE__ */ jsx("p", { className: "fine", children: "\uB2EC\uC758 \uB0A0\uC9DC\uAD6C\uB098 \u2014 \uD558\uB298\uC758 \uB2EC\uB825\uC73C\uB85C \uBC14\uAFD4 \uC77D\uC5B4\uC904\uAC8C." }),
        err && /* @__PURE__ */ jsx("p", { className: "err", children: err }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => {
          const y = +birth.y, m = +birth.m, d = +birth.d;
          if (!y || !m || !d || y < 1900 || y > (/* @__PURE__ */ new Date()).getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) {
            setErr("\uC0DD\uB144\uC6D4\uC77C\uC744 \uD655\uC778\uD574\uC918. \uB108\uB97C \uB610\uB837\uD558\uAC8C \uBCF4\uB824\uBA74 \uC815\uD655\uD574\uC57C \uD574.");
            return;
          }
          const _age = exactAge(y, m, d);
          if (_age !== null && _age < 14) {
            track("age_gate_blocked", { age_band: "14\uC138 \uBBF8\uB9CC" });
            setErr("\uC544\uC9C1\uC740 \uB124 \uD558\uB298\uC744 \uC5F4 \uC218 \uC5C6\uC5B4. \uC5F4\uB137\uC758 \uBD04\uC744 \uC9C0\uB098\uACE0 \uB2E4\uC2DC \uB098\uB97C \uBD88\uB7EC\uC918 \u2014 \uADF8\uB54C \uB124 \uACC1\uC73C\uB85C \uAC08\uAC8C.");
            return;
          }
          setErr("");
          setBstep(2);
        }, children: "\uC774 \uD558\uB298\uC774\uC57C" })
      ] }, 1),
      bstep === 2 && /* @__PURE__ */ jsxs("div", { className: "bscene", children: [
        /* @__PURE__ */ jsx("p", { className: "line", children: "\uBA87 \uC2DC\uC600\uB294\uC9C0\uB3C4 \uAE30\uC5B5\uB098?" }),
        /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
          /* @__PURE__ */ jsx("input", { className: "in sm", placeholder: "14", inputMode: "numeric", maxLength: 2, disabled: birth.noHour, value: birth.h, onChange: (e) => setBirth({ ...birth, h: e.target.value }) }),
          /* @__PURE__ */ jsx("span", { className: "unit", children: "\uC2DC" }),
          /* @__PURE__ */ jsx("input", { className: "in sm", placeholder: "30", inputMode: "numeric", maxLength: 2, disabled: birth.noHour, value: birth.min, onChange: (e) => setBirth({ ...birth, min: e.target.value }) }),
          /* @__PURE__ */ jsx("span", { className: "unit", children: "\uBD84" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "chk", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: birth.noHour, onChange: (e) => setBirth({ ...birth, noHour: e.target.checked }) }),
          " \uBAA8\uB984 ",
          /* @__PURE__ */ jsx("em", { children: "(\uAD1C\uCC2E\uC544, \uC870\uAE08 \uD750\uB9AC\uAC8C \uBCF4\uC77C \uBFD0\uC774\uC57C)" })
        ] }),
        /* @__PURE__ */ jsx("input", { className: "in wide center box", lang: "ko", placeholder: "\uD0DC\uC5B4\uB09C \uB3C4\uC2DC (\uAC74\uB108\uB6F0\uC5B4\uB3C4 \uB3FC)", value: birth.city, onChange: (e) => setBirth({ ...birth, city: e.target.value }) }),
        bornSummary(birth) && /* @__PURE__ */ jsxs("p", { className: "confirmline", children: [
          bornSummary(birth),
          " \u2014 \uB9DE\uC544?"
        ] }),
        err && /* @__PURE__ */ jsx("p", { className: "err", children: err }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => {
          if (!birth.noHour) {
            const h = +birth.h;
            if (birth.h === "" || h < 0 || h > 23) {
              setErr("\uD0DC\uC5B4\uB09C \uC2DC(0~23\uC2DC)\uB97C \uC54C\uB824\uC8FC\uAC70\uB098 '\uBAA8\uB984'\uC744 \uC120\uD0DD\uD574\uC918.");
              return;
            }
            if (birth.min !== "" && (+birth.min < 0 || +birth.min > 59)) {
              setErr("\uBD84\uC740 0~59 \uC0AC\uC774\uB85C \uC54C\uB824\uC918.");
              return;
            }
          }
          setErr("");
          setBstep(3);
        }, children: "\uAE30\uC5B5\uB0AC\uC5B4" })
      ] }, 2),
      bstep === 3 && /* @__PURE__ */ jsxs("div", { className: "bscene", children: [
        /* @__PURE__ */ jsx("p", { className: "line", children: birth.name.trim() ? `${birth.name.trim()}, \uB9C8\uC9C0\uB9C9 \uC870\uAC01\uC774\uC57C \u2014 \uD558\uB298\uC740 \uB108\uB97C \uC5B4\uB290 \uD750\uB984\uC5D0 \uC2E4\uC5B4 \uBCF4\uB0C8\uC744\uAE4C.` : "\uB9C8\uC9C0\uB9C9 \uC870\uAC01 \u2014 \uD558\uB298\uC740 \uB108\uB97C \uC5B4\uB290 \uD750\uB984\uC5D0 \uC2E4\uC5B4 \uBCF4\uB0C8\uC744\uAE4C." }),
        /* @__PURE__ */ jsxs("p", { className: "sub2", children: [
          "\uC74C\uACFC \uC591\uC758 \uD750\uB984\uC740 \uC778\uC0DD\uC758 \uACC4\uC808(\uB300\uC6B4)\uC744 \uC77D\uB294 \uC5F4\uC1E0\uC57C.",
          /* @__PURE__ */ jsx("br", {}),
          "\uB9D0\uD558\uACE0 \uC2F6\uC9C0 \uC54A\uC73C\uBA74 \uADF8\uB0E5 \uB118\uC5B4\uAC00\uB3C4 \uB3FC."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (birth.sex === "M" ? "on" : ""), onClick: () => setBirth({ ...birth, sex: birth.sex === "M" ? "" : "M" }), children: "\uB0A8" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (birth.sex === "F" ? "on" : ""), onClick: () => setBirth({ ...birth, sex: birth.sex === "F" ? "" : "F" }), children: "\uC5EC" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => {
          setErr("");
          setBstep(4);
        }, children: "\uB2E4\uC74C" })
      ] }, 3),
      bstep === 4 && /* @__PURE__ */ jsxs("div", { className: "bscene", children: [
        /* @__PURE__ */ jsx("p", { className: "line", children: "\uADF8\uB798 \u2014 \uB108\uC5D0 \uB300\uD55C \uAE30\uC5B5\uC774 \uB3CC\uC544\uC624\uACE0 \uC788\uC5B4." }),
        /* @__PURE__ */ jsxs("p", { className: "sub2", children: [
          "\uC9C0\uAE08\uC758 \uB10C \uC5B4\uB5BB\uAC8C \uCEF8\uC5B4? \uC9C0\uAE08 \uB110 \uC54C\uBA74 \uD310\uACB0\uC774 \uB354 \uB9DE\uC544\uC838.",
          /* @__PURE__ */ jsx("br", {}),
          "\uB9D0\uD558\uACE0 \uC2F6\uC9C0 \uC54A\uC73C\uBA74 \uADF8\uB0E5 \uC5F4\uC5B4\uB3C4 \uB3FC."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "ctxblock", children: [
          /* @__PURE__ */ jsx("div", { className: "row gap center wrap", children: ["\uD559\uC0DD", "\uC9C1\uC7A5\uC778", "\uC0AC\uC5C5\uAC00", "\uD504\uB9AC\uB79C\uC11C", "\uC8FC\uBD80", "\uC26C\uB294 \uC911"].map((t) => /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm " + (birth.job === t ? "on" : ""), onClick: () => setBirth({ ...birth, job: birth.job === t ? "" : t }), children: t }, t)) }),
          /* @__PURE__ */ jsx("div", { className: "row gap center wrap", children: ["\uC5F0\uC560 \uC911", "\uC194\uB85C", "\uACB0\uD63C", "\uC774\uD63C\xB7\uC774\uBCC4"].map((t) => /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm " + (birth.rel === t ? "on" : ""), onClick: () => setBirth({ ...birth, rel: birth.rel === t ? "" : t }), children: t }, t)) })
        ] }),
        err && /* @__PURE__ */ jsx("p", { className: "err", children: err }),
        /* @__PURE__ */ jsx("div", { className: "consent", children: /* @__PURE__ */ jsxs("p", { className: "fine", children: [
          "\uB124\uAC00 \uC900 \uC870\uAC01(\uB098\uC774\xB7\uC131\uBCC4\xB7\uC9C1\uC5C5\xB7MBTI\xB7\uAC00\uCE58 \uAC19\uC740 \uAC83)\uC740 \uD310\uACB0\uC744 \uB2E4\uB4EC\uB294 \uB370 \uC368.",
          /* @__PURE__ */ jsx("strong", { children: "\uB124\uAC00 \uC801\uC740 \uC9C8\uBB38\uC740 \uBCF4\uB0B4\uC9C0 \uC54A\uC544." }),
          /* @__PURE__ */ jsx("br", {}),
          "\u2018\uD558\uB298\uC744 \uC5F4\uAE30\u2019\uB97C \uB204\uB974\uBA74 ",
          /* @__PURE__ */ jsx("a", { className: "plink", href: "/privacy.html", target: "_blank", rel: "noreferrer", children: "\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68" }),
          "\uC5D0 \uB3D9\uC758\uD55C \uAC83\uC73C\uB85C \uBCFC\uAC8C."
        ] }) }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: doReveal, children: "\uD558\uB298\uC744 \uC5F4\uAE30" })
      ] }, 4),
      bstep > 0 && /* @__PURE__ */ jsx("button", { className: "resetlink", onClick: () => {
        setErr("");
        setBstep(bstep - 1);
      }, children: "\uC544\uAE4C \uC7A5\uBA74\uC73C\uB85C \uB3CC\uC544\uAC08\uB798" })
    ] }),
    step === 2 && saju && /* @__PURE__ */ jsxs("section", { className: "scene fade", children: [
      /* @__PURE__ */ jsxs("div", { className: "halo", children: [
        /* @__PURE__ */ jsx(DustOrb, { size: 210, stage: recallSeen ? 3 : 1, tint: saju ? EL_COLOR[saju.main] : void 0 }),
        /* @__PURE__ */ jsx("div", { className: "gtext", children: reveal >= 5 && mbti && /* @__PURE__ */ jsx("p", { className: "gname fade", children: "\uAE30\uC5B5\uC774 \uB2E4 \uB3CC\uC544\uC654\uC5B4" }) })
      ] }),
      reveal >= 1 && reveal < 5 && /* @__PURE__ */ jsxs("div", { className: "rvstage", children: [
        reveal === 1 && /* @__PURE__ */ jsxs("div", { className: "rvbig", children: [
          /* @__PURE__ */ jsx("span", { children: "\uC0AC\uC8FC \u2014 \uD0DC\uC5B4\uB09C \uC21C\uAC04\uC758 \uD558\uB298" }),
          /* @__PURE__ */ jsxs("b", { children: [
            saju.pillars.\uB144,
            " \xB7 ",
            saju.pillars.\uC6D4,
            " \xB7 ",
            saju.pillars.\uC77C,
            " \xB7 ",
            saju.pillars.\uC2DC
          ] }),
          birth.lunarNote && /* @__PURE__ */ jsxs("i", { className: "rvlunar", children: [
            birth.lunarNote,
            " \u2014 \uD558\uB298\uC758 \uB2EC\uB825\uC73C\uB85C \uBC14\uAFD4 \uC77D\uC5C8\uC5B4"
          ] })
        ] }, 1),
        reveal === 2 && /* @__PURE__ */ jsxs("div", { className: "rvbig", children: [
          /* @__PURE__ */ jsx("span", { children: "\uBCC4\uC790\uB9AC" }),
          /* @__PURE__ */ jsxs("b", { children: [
            zo.name,
            " \u2014 ",
            zo.el,
            "\uC758 \uBCC4"
          ] })
        ] }, 2),
        reveal === 3 && /* @__PURE__ */ jsxs("div", { className: "rvbig", children: [
          /* @__PURE__ */ jsx("span", { children: "\uD0DC\uC5B4\uB09C \uBC24\uC758 \uB2EC" }),
          /* @__PURE__ */ jsxs("b", { children: [
            moon.name,
            " \u2014 ",
            moon.sub
          ] })
        ] }, 3),
        reveal === 4 && /* @__PURE__ */ jsxs("div", { className: "rvbig", children: [
          /* @__PURE__ */ jsx("span", { children: "\uC218\uBE44\uD559" }),
          /* @__PURE__ */ jsxs("b", { children: [
            num,
            "\uC758 \uAE38"
          ] })
        ] }, 4),
        /* @__PURE__ */ jsx("p", { className: "sub2", children: "\uC783\uC5B4\uBC84\uB9B0 \uAE30\uC5B5\uC774 \uB3CC\uC544\uC624\uACE0 \uC788\uC5B4\u2026" })
      ] }),
      reveal >= 5 && /* @__PURE__ */ jsx("div", { className: "fade", children: !recallSeen ? /* @__PURE__ */ jsxs("div", { className: "fade", children: [
        /* @__PURE__ */ jsxs("p", { className: "mention", children: [
          "\uADF8\uB798 \u2014 ",
          birth.name ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("b", { children: birth.name }),
            ", "
          ] }) : "",
          "\uC6D0\uB798 ",
          /* @__PURE__ */ jsx("b", { children: EL_TRAIT[saju.main] }),
          " \uB108\uC600\uC9C0.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("b", { children: MOON_DRIVE[moon.name] }),
          " \uBAA8\uC2B5\uC774 \uB298 \uBA4B\uC788\uC5C8\uC5B4."
        ] }),
        /* @__PURE__ */ jsxs("details", { className: "refbox", open: true, children: [
          /* @__PURE__ */ jsx("summary", { children: "\uAE30\uC5B5\uC758 \uADFC\uAC70 \uC0B4\uD3B4\uBCF4\uAE30" }),
          /* @__PURE__ */ jsx("div", { className: "bars", children: Object.entries(saju.counts).map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "bar", children: [
            /* @__PURE__ */ jsx("span", { children: k }),
            /* @__PURE__ */ jsx("i", { style: { width: `${v * 14}%`, background: EL_COLOR[k][0] } }),
            /* @__PURE__ */ jsx("b", { children: v })
          ] }, k)) }),
          /* @__PURE__ */ jsxs("p", { className: "refline", children: [
            saju.dayGan ? `\uC77C\uAC04 ${saju.dayGan}(${saju.main})` : `\uC8FC\uAE30\uC6B4 ${saju.main}`,
            " \u2014 ",
            EL_READ[saju.main]
          ] }),
          /* @__PURE__ */ jsx("p", { className: "refline", children: ZO_READ[zo.el] }),
          /* @__PURE__ */ jsx("p", { className: "refline", children: moon.read }),
          /* @__PURE__ */ jsx("p", { className: "refline", children: LP_READ[num] })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => {
          setRecallSeen(true);
          setStep(25);
        }, children: "\uC751, \uAE30\uC5B5\uB098" })
      ] }, "recall") : /* @__PURE__ */ jsx("div", { className: "fade" }, "skip") })
    ] }),
    step === 25 && /* @__PURE__ */ jsxs("section", { className: "scene stepv fade", children: [
      /* @__PURE__ */ jsx("div", { className: "halo", children: /* @__PURE__ */ jsx(DustOrb, { size: 210, stage: vstage > 0 ? 3 : 2, tint: saju ? EL_COLOR[saju.main] : void 0 }) }),
      /* @__PURE__ */ jsx("p", { className: "gname under", children: vstage === 0 ? "\uB9C8\uC74C\uC758 \uBC29" : vstage === 1 ? "\uD3EC\uAE30\uC758 \uBC29" : "\uB2E8 \uD558\uB098" }),
      /* @__PURE__ */ jsxs("div", { className: "fade", children: [
        /* @__PURE__ */ jsx("p", { className: "sub2", children: vstage === 0 ? "\uB108\uB97C \uC6C0\uC9C1\uC774\uB294 \uB9D0\uB4E4\uC774\uC57C. \uC0DD\uAC01 \uB9D0\uACE0, \uC190\uC774 \uAC00\uB294 \uB300\uB85C \uC5EC\uC12F \uAC1C." : vstage === 1 ? "\uC5EC\uC12F \uC911 \uC14B\uB9CC \uC9C0\uD0AC \uC218 \uC788\uC5B4. \uBB34\uC5C7\uC744 \uB0B4\uB824\uB193\uB294\uC9C0\uAC00 \uC9C4\uC9DC \uB108\uC57C." : "\uB9C8\uC9C0\uB9C9\uC774\uC57C \u2014 \uB2E8 \uD558\uB098\uB9CC \uC9C0\uD0AC \uC218 \uC788\uB2E4\uBA74." }),
        /* @__PURE__ */ jsx("div", { className: "grid16", children: (vstage === 0 ? VALUES16 : vstage === 1 ? vals8 : vals4).map((v) => /* @__PURE__ */ jsx("button", { className: `cell ${(vstage === 0 ? vals8 : vstage === 1 ? vals4 : [core]).includes(v) ? "sel" : ""}`, onClick: () => pick(v), children: v }, v)) }),
        /* @__PURE__ */ jsx("p", { className: "fine", children: vstage === 0 ? `${vals8.length} / 6` : vstage === 1 ? `${vals4.length} / 3` : core ? `\uD575\uC2EC \u2014 ${core}` : "\uD558\uB098\uB97C \uACE8\uB77C\uC918" }),
        vstage === 0 && vals8.length === 6 && /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => setVstage(1), children: "\uC5EC\uC12F \uAC1C \uACE8\uB790\uC5B4" }),
        vstage === 1 && vals4.length === 3 && /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => setVstage(2), children: "\uC14B\uC744 \uB0A8\uACBC\uC5B4" }),
        vstage === 2 && core && /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: () => {
          track("guardian_awaken");
          setStep(3);
        }, children: "\uC218\uD638\uC2E0 \uAE68\uC6B0\uAE30" })
      ] }, vstage)
    ] }),
    step === 3 && /* @__PURE__ */ jsxs("section", { className: `scene fade ${phase >= 1 && !res && !awake ? "lobby" : ""}`, onClick: phase >= 1 && !res && !awake ? tryWake : void 0, children: [
      /* @__PURE__ */ jsxs("div", { className: `halo wide ${!awake && phase >= 1 && !res ? "lobbyscale" : ""} ${asking ? "asking" : ""} ${ritual ? "ritualfade" : ""} ${busy || res && !cardOn ? "busy" : ""} ${res && cardOn ? "dimmed" : ""}`, children: [
        phase === 0 ? /* @__PURE__ */ jsx(BirthCanvas, { tint: saju ? EL_COLOR[saju.main] : void 0, size: Math.min(typeof window !== "undefined" ? window.innerWidth * 1.1 : 400, typeof window !== "undefined" ? window.innerHeight * 0.57 : 400, 640) }) : /* @__PURE__ */ jsx("div", { className: "fade", children: /* @__PURE__ */ jsx(Guardian, { saju, zo, mbti, num, moon, birth, agitateRef, reactRef, restRef, size: Math.min(typeof window !== "undefined" ? window.innerWidth * 1.1 : 400, typeof window !== "undefined" ? window.innerHeight * 0.57 : 400, 640) }) }),
        /* @__PURE__ */ jsx("div", { className: "gtext up", children: phase === 0 && /* @__PURE__ */ jsxs("div", { className: "formwrap", children: [
          /* @__PURE__ */ jsxs("p", { className: "forming", children: [
            birth.name ? `${birth.name}, \uD769\uC5B4\uC838 \uC788\uB358 \uC870\uAC01\uB4E4\uC774` : "\uD769\uC5B4\uC838 \uC788\uB358 \uC870\uAC01\uB4E4\uC774",
            /* @__PURE__ */ jsx("br", {}),
            "\uB108\uB97C \uD5A5\uD574 \uBAA8\uC774\uACE0 \uC788\uC5B4\u2026",
            /* @__PURE__ */ jsx("br", {}),
            "\uB108\uC758 \uC218\uD638\uC2E0\uC774 \uB3CC\uC544\uC624\uB294 \uC911\uC774\uC57C."
          ] }),
          /* @__PURE__ */ jsx("ul", { className: "formsteps", children: FORM_STEPS.map((s, i) => /* @__PURE__ */ jsxs("li", { className: i < formStep ? "done" : i === formStep ? "now" : "", children: [
            i < formStep ? "\u2713" : i === formStep ? "\u2726" : "\xB7",
            " ",
            s,
            i === formStep ? "\u2026" : ""
          ] }, i)) })
        ] }) })
      ] }),
      phase >= 1 && !res && !awake && /* @__PURE__ */ jsxs("div", { className: "lobbypanel fade", children: [
        letterSent ? /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "gsay fade", children: LETTER_LOBBY_LINE }),
          letterDoc && !letterDoc._err && /* @__PURE__ */ jsxs("div", { className: "mailbox fade", style: { animationDelay: ".95s" }, children: [
            /* @__PURE__ */ jsx("p", { className: "dtag", children: "\uC218\uD638\uC2E0\uC758 \uC11C\uC2E0 \xB7 \uB3C4\uCC29" }),
            /* @__PURE__ */ jsx("button", { className: "btn gold sm", onClick: openLetterDoc, children: "\uC11C\uC2E0\uC744 \uD3BC\uCE5C\uB2E4" })
          ] }),
          letterDoc && letterDoc._err && /* @__PURE__ */ jsx("p", { className: "gsay fade", style: { animationDelay: ".95s" }, children: "\uC11C\uC2E0\uC774 \uC190\uC5D0\uC11C \uD769\uC5B4\uC84C\uC5B4 \u2014 \uC774\uBC88 \uAC74 \uB0B4 \uC798\uBABB\uC774\uC57C. \uB2E4\uC2DC \uBB3C\uC5B4\uBD10 \uC904\uB798?" }),
          !letterDoc && /* @__PURE__ */ jsxs("p", { className: "gsay writing fade", style: { animationDelay: ".95s" }, children: [
            "\uC218\uD638\uC2E0\uC774 \uC11C\uC2E0\uC744 \uC4F0\uACE0 \uC788\uC5B4",
            /* @__PURE__ */ jsxs("span", { className: "dots", children: [
              /* @__PURE__ */ jsx("i", { children: "." }),
              /* @__PURE__ */ jsx("i", { children: "." }),
              /* @__PURE__ */ jsx("i", { children: "." })
            ] })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "gsay fade", style: { animationDelay: "1.5s" }, children: letterDoc && !letterDoc._err ? LETTER_NUDGE_DONE : LETTER_NUDGE_LINE })
        ] }) : returning ? /* @__PURE__ */ jsx("p", { className: "gsay fade", children: "\uB2E4\uC2DC \uC654\uB124" + (birth.name ? ", " + birth.name : "") + ". \uAE30\uB2E4\uB838\uC5B4." }) : justBorn ? /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "gsay born fade", children: "\u2014 \uB2E4\uC2DC \uB9CC\uB0AC\uB124. \uB0B4\uAC00 \uB108\uC758 \uC218\uD638\uC2E0\uC774\uC57C." }),
          /* @__PURE__ */ jsx("p", { className: "gsay fade", style: { animationDelay: ".95s" }, children: guardianIntro }),
          /* @__PURE__ */ jsx("p", { className: "gsay sprite fade", style: { animationDelay: "1.9s" }, children: "\uC544, \uC870\uAC01 \uD558\uB098\uB294 \uB2EC\uBE5B\uC5D0 \uBB3C\uB4E4\uC5B4 \uACC1\uC5D0 \uB0A8\uC558\uC5B4. \uAE4C\uBD88 \uAC70\uC57C \u2014 '\uC815\uB839'\uC774\uC57C." })
        ] }) : null,
        /* @__PURE__ */ jsx("p", { className: "wakehint", children: letterSent ? "\uB450\uB4DC\uB824\uBD10 \u2014 \uD558\uB098 \uB354 \uBB3C\uC5B4\uB3C4 \uB3FC" : "\uB450\uB4DC\uB824\uBD10 \u2014 \uB2F5\uC740 \uAC70\uAE30 \uC788\uC5B4" })
      ] }),
      ritual && /* @__PURE__ */ jsx("div", { className: "residue", style: { "--elc": saju ? EL_COLOR[saju.main][0] : "#f5d98b" } }),
      phase >= 1 && !res && awake && /* @__PURE__ */ jsxs("div", { className: `fade gpanel ${asking ? "asking" : ""}`, children: [
        returning && !res && !busy && !ritual && (!birth.name || !birth.sex) && (addOpen ? /* @__PURE__ */ jsxs("div", { className: "addpanel fade", children: [
          !birth.name && /* @__PURE__ */ jsx("input", { className: "in wide center", lang: "ko", placeholder: "\uB108\uB97C \uBB50\uB77C\uACE0 \uBD80\uB97C\uAE4C?", maxLength: 12, value: addName, onChange: (e) => setAddName(e.target.value) }),
          !birth.sex && /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (addSex === "M" ? "on" : ""), onClick: () => setAddSex(addSex === "M" ? "" : "M"), children: "\uB0A8" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn " + (addSex === "F" ? "on" : ""), onClick: () => setAddSex(addSex === "F" ? "" : "F"), children: "\uC5EC" }),
            /* @__PURE__ */ jsx("span", { className: "chk", children: /* @__PURE__ */ jsx("em", { children: "\uC778\uC0DD\uC758 \uACC4\uC808(\uB300\uC6B4)\uC744 \uC77D\uB294 \uC5F4\uC1E0" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { className: "btn gold", onClick: () => {
              const nb = { ...birth, name: birth.name || addName.trim(), sex: birth.sex || addSex };
              setBirth(nb);
              saveMemory({ birth: nb, saju, zo, moon, num, mbti, vals8, vals4, core, convo, records, streak });
              setAddOpen(false);
            }, children: "\uC870\uAC01\uC744 \uBCF4\uD0E4\uAC8C" }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost", onClick: () => setAddOpen(false), children: "\uB2E4\uC74C\uC5D0" })
          ] })
        ] }) : /* @__PURE__ */ jsxs("button", { className: "knock fade", onClick: () => setAddOpen(true), children: [
          "\uC218\uD638\uC2E0\uC774 \uC544\uC9C1 \uBABB \uCC3E\uC740 \uC870\uAC01\uC774 \uC788\uB300 \u2014 ",
          !birth.name && !birth.sex ? "\uC774\uB984\uACFC \uD750\uB984" : !birth.name ? "\uC774\uB984" : "\uC74C\uC591\uC758 \uD750\uB984"
        ] })),
        returning && streak && streak.count >= 2 && !res && /* @__PURE__ */ jsxs("p", { className: "streak", children: [
          "\uC218\uD638\uC2E0\uACFC \uC5F0\uACB0\uB41C \uC9C0 ",
          streak.count,
          "\uC77C\uC9F8"
        ] }),
        dailyData && !ritual && !res && !askback && !dailyOpen && /* @__PURE__ */ jsx("button", { className: "knock fade", onClick: () => setDailyOpen(true), children: "\uC218\uD638\uC2E0\uC774 \uC624\uB298\uC758 \uD558\uB298\uC744 \uBD10\uB480\uC5B4 \u2014 \uB4E4\uC744\uB798?" }),
        dailyData && !ritual && !res && !askback && dailyOpen && /* @__PURE__ */ jsxs("div", { className: "daily fade", children: [
          /* @__PURE__ */ jsx("p", { className: "dtag", children: "\uC544\uCE68 \uBB38\uC548 \xB7 \uC624\uB298 \uD558\uB8E8\uB9CC \u2014 \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838" }),
          /* @__PURE__ */ jsxs("p", { className: "dmain", children: [
            "\uC624\uB298\uC740 ",
            /* @__PURE__ */ jsx("b", { children: dailyData.mood.k }),
            ". ",
            dailyData.mood.line
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "dsub", children: [
            "\uC624\uB298\uC758 \uC77C\uC9C4 ",
            dailyData.ilju,
            " \xB7 \uC624\uB298 \uBC24 \uB2EC ",
            dailyData.mp.name
          ] }),
          /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => {
            try {
              store.setItem(DAILY_KEY, todayStr());
            } catch (_) {
            }
            setDailySeen(true);
          }, children: "\uBC1B\uC558\uC5B4" })
        ] }),
        askback && !ritual && !res && /* @__PURE__ */ jsxs("div", { className: "daily fade", children: [
          /* @__PURE__ */ jsxs("p", { className: "dtag", children: [
            "\uC9C0\uB09C \uD310\uACB0 \xB7 ",
            askback.direction
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "dmain", children: [
            '\uC9C0\uB09C\uBC88 \uBB3C\uC74C \u2014 "',
            askback.q,
            '"'
          ] }),
          askback.verdict && /* @__PURE__ */ jsxs("p", { className: "dverdict", children: [
            '\uB0B4\uAC00 \uC774\uB807\uAC8C \uB9D0\uD588\uC9C0 \u2014 "',
            askback.verdict,
            '"'
          ] }),
          /* @__PURE__ */ jsx("p", { className: "dmain", children: "\uADF8\uB798\uC11C, \uACB0\uAD6D \uC5B4\uB5BB\uAC8C \uD588\uC5B4?" }),
          !noting ? /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => answerAskback("did"), children: "\uB530\uB790\uC5B4" }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => setNoting(true), children: "\uAC70\uC2AC\uB800\uC5B4" }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => answerAskback("later"), children: "\uC544\uC9C1" })
          ] }) : /* @__PURE__ */ jsxs("div", { className: "w100", children: [
            /* @__PURE__ */ jsx("input", { className: "in wide", placeholder: "\uADF8\uB798\uC11C \uC5B4\uB560\uB294\uB370? (\uD55C \uC904)", value: askNote, onChange: (e) => setAskNote(e.target.value) }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm mt", onClick: () => answerAskback("against", askNote), children: "\uC774\uB807\uAC8C \uB410\uC5B4" })
          ] })
        ] }),
        !ritual && /* @__PURE__ */ jsx("p", { className: "gintro dim2", children: isNight ? "\uBC24\uC774 \uAE4A\uC5C8\uB124. \uC774 \uC2DC\uAC04\uC758 \uBB3C\uC74C\uC740 \uB9C8\uC74C\uC774 \uBA3C\uC800 \uAE30\uC6B8\uC5B4 \uC788\uAE30 \uB9C8\uB828\uC774\uC57C." : "\uADF8\uB798\uC11C, \uC694\uC998 \uBB58 \uB9DD\uC124\uC774\uACE0 \uC788\uC5B4?" }),
        !ritual && /* @__PURE__ */ jsx("textarea", { className: "qbox", rows: 2, maxLength: 100, value: q, placeholder: `"${QHINTS[qhintI]}"`, onChange: (e) => setQ(e.target.value) }),
        !ritual && !res && q.trim().length > 0 && isDecisionQ(q) && /* @__PURE__ */ jsxs("div", { className: "leanrow fade", children: [
          /* @__PURE__ */ jsxs("span", { className: "leanlab", children: [
            "\uC65C \uB9DD\uC124\uC5EC? ",
            /* @__PURE__ */ jsx("em", { className: "dim", children: "(\uC548 \uACE8\uB77C\uB3C4 \uB3FC)" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "row gap center wrap", children: ["\uB450\uB824\uC6CC\uC11C", "\uB0A8 \uB208\uCE58", "\uC815\uBCF4\uAC00 \uBD80\uC871\uD574", "\uC790\uC2E0\uC774 \uC5C6\uC5B4\uC11C", "\uD6C4\uD68C\uD560\uAE4C \uBD10"].map((t) => /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm " + (hesit === t ? "on" : ""), onClick: () => setHesit(hesit === t ? "" : t), children: t }, t)) })
        ] }),
        !ritual && /* @__PURE__ */ jsxs("div", { className: "w100", children: [
          /* @__PURE__ */ jsx("div", { className: "row gap center", children: /* @__PURE__ */ jsx("button", { className: "btn gold", onClick: () => {
            if (!q.trim()) {
              setErr("\uBA3C\uC800 \uC9C8\uBB38\uC744 \uC801\uC5B4\uC918.");
              return;
            }
            setErr("");
            setRitual(true);
          }, disabled: busy, children: "\uD310\uACB0\uC744 \uCCAD\uD55C\uB2E4" }) }),
          /* @__PURE__ */ jsx("p", { className: "fine", children: "\uB3D9\uC804 \uC14B\uC744 \uB358\uC838 \uD558\uB298\uC758 \uB73B\uC744 \uBB3B\uB294\uB2E4 \u2014 \uBB34\uC5C7\uC744 \uBB3B\uB4E0 \uAC19\uC740 \uBB34\uAC8C\uB85C \uBCF8\uB2E4." })
        ] }),
        !ritual && !res && paidRecs.length > 0 && /* @__PURE__ */ jsx("button", { className: "knock fade", onClick: () => {
          setBoxOpen((o) => !o);
          if (!boxOpen) track("letterbox_opened", { n: paidRecs.length, lost: paidRecs.filter((p) => !p.r.letter).length });
        }, children: boxOpen ? "\uC11C\uC2E0\uD568 \uC811\uAE30" : `\uC218\uD638\uC2E0\uC758 \uC11C\uC2E0\uD568 \u2014 ${paidRecs.length}\uD1B5${paidRecs.some((p) => !p.r.letter) ? " \xB7 \uBABB \uBC1B\uC740 \uAC8C \uC788\uC5B4" : ""}` }),
        !ritual && !res && boxOpen && /* @__PURE__ */ jsxs("div", { className: "lbox fade", children: [
          paidRecs.slice().reverse().map(({ r, i }) => /* @__PURE__ */ jsxs("div", { className: "lboxrow", children: [
            /* @__PURE__ */ jsxs("div", { className: "lboxtxt", children: [
              /* @__PURE__ */ jsxs("p", { className: "lboxq", children: [
                '"',
                r.q,
                '"'
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "lboxno", children: [
                "\uC11C\uC2E0 \uBC88\uD638 ",
                letterNo(r),
                " \xB7 ",
                new Date(r.at).toLocaleDateString("ko-KR")
              ] })
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn sm " + (r.letter ? "ghost" : "gold"), disabled: letterBusy, onClick: () => reissueLetter(i), children: r.letter ? "\uD3BC\uCE58\uAE30" : letterBusy ? "\uC4F0\uB294 \uC911\u2026" : "\uB2E4\uC2DC \uBC1B\uAE30" })
          ] }, i)),
          /* @__PURE__ */ jsxs("p", { className: "fine", children: [
            "\uC11C\uC2E0\uC740 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00\uB3FC. \uAE30\uAE30\uB97C \uBC14\uAFB8\uAC70\uB098 \uC9C0\uC6CC\uC84C\uB2E4\uBA74 ",
            /* @__PURE__ */ jsx("b", { children: "\uBC88\uD638\uB97C \uB300\uACE0 \uB2E4\uC2DC \uBC1B\uC73C\uBA74" }),
            " \uB3FC \u2014 \uAC12\uC740 \uB2E4\uC2DC \uC548 \uBC1B\uC544."
          ] })
        ] }),
        !ritual && !res && saju && /* @__PURE__ */ jsxs("button", { className: "btn ghost mt w100", onClick: () => {
          track("imprint_clicked", { price: IMPRINT_PRICE, nth_verdict: records.length });
          setImprintOpen(true);
        }, children: [
          "\uAC01\uC778 \u2014 \uB124\uAC00 \uC5B4\uB5BB\uAC8C \uB9CC\uB4E4\uC5B4\uC84C\uB294\uC9C0 ",
          /* @__PURE__ */ jsx("span", { className: "impbadge", children: "\uC2DC\uD5D8 \uBC1C\uD589" })
        ] }),
        !ritual && !res && records.length > 0 && /* @__PURE__ */ jsx("button", { className: "resetlink", onClick: () => {
          setLogOpen((o) => !o);
          setOpenRec(-1);
        }, children: logOpen ? "\uD310\uACB0\uB85D \uC811\uAE30" : `\uD310\uACB0\uB85D \u2014 ${records.length}\uBC88\uC758 \uD310\uACB0` }),
        !ritual && !res && logOpen && /* @__PURE__ */ jsxs("div", { className: "vlog fade", children: [
          [...records].slice(-10).reverse().map((r, i) => /* @__PURE__ */ jsxs("div", { className: `vlogrow${openRec === i ? " open" : ""}`, onClick: () => setOpenRec(openRec === i ? -1 : i), children: [
            /* @__PURE__ */ jsx(BujeokCanvas, { saju, direction: r.direction, seed: r.q + (r.verdict || ""), size: 54 }),
            /* @__PURE__ */ jsxs("div", { className: "vlogtxt", children: [
              /* @__PURE__ */ jsxs("p", { className: "vlogq", children: [
                '"',
                r.q,
                '"'
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "vlogmeta", children: [
                new Date(r.at).toLocaleDateString("ko-KR"),
                " \xB7 ",
                /* @__PURE__ */ jsx("b", { className: r.direction === "GO" ? "lgo" : r.direction === "HOLD" ? "lhold" : "lstop", children: r.direction }),
                " \xB7 ",
                r.followUp === "did" ? "\uB530\uB790\uB2E4" : r.followUp === "against" ? "\uAC70\uC2AC\uB800\uB2E4" : r.followUp === "later" ? "\uC544\uC9C1" : "\uBBF8\uBCF4\uACE0"
              ] }),
              openRec === i && r.verdict && /* @__PURE__ */ jsxs("p", { className: "vlogverdict fade", children: [
                '"',
                r.verdict,
                '"'
              ] })
            ] })
          ] }, i)),
          records.length > 10 && /* @__PURE__ */ jsx("p", { className: "fine", children: "\uCD5C\uADFC 10\uAC74\uB9CC \u2014 \uB098\uBA38\uC9C0\uB3C4 \uAE30\uC5B5\uD558\uACE0 \uC788\uC5B4." })
        ] }),
        !ritual && returning && !res && (resetAsk ? /* @__PURE__ */ jsxs("div", { className: "fade", style: { textAlign: "center" }, children: [
          /* @__PURE__ */ jsx("p", { className: "sub2", children: "\uC815\uB9D0 \uCC98\uC74C\uBD80\uD130? \uC9C0\uAE08\uC758 \uC218\uD638\uC2E0\uACFC \uAE30\uC5B5\uC774 \uD769\uC5B4\uC838." }),
          /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => {
              clearMemory();
              window.location.reload();
            }, children: "\uC751, \uD769\uC5B4\uC838\uB3C4 \uB3FC" }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => setResetAsk(false), children: "\uC544\uB2C8" })
          ] })
        ] }) : /* @__PURE__ */ jsx("button", { className: "resetlink", onClick: () => setResetAsk(true), children: "\uB2E4\uB978 \uC0AC\uB78C\uC774\uC57C? \u2014 \uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC" })),
        !ritual && returning && !res && /* @__PURE__ */ jsxs("div", { className: "memrow", children: [
          /* @__PURE__ */ jsx("button", { className: "resetlink", onClick: exportMemory, children: "\uC218\uD638\uC2E0 \uAE30\uC5B5 \uBCF4\uAD00\uD558\uAE30" }),
          /* @__PURE__ */ jsxs("label", { className: "resetlink", style: { cursor: "pointer" }, children: [
            "\uAE30\uC5B5 \uBD88\uB7EC\uC624\uAE30",
            /* @__PURE__ */ jsx("input", { type: "file", accept: "application/json", style: { display: "none" }, onChange: (e) => e.target.files && e.target.files[0] && importMemory(e.target.files[0]) })
          ] })
        ] }),
        ritual && !res && /* @__PURE__ */ jsxs("div", { className: "hexpanel fade", children: [
          /* @__PURE__ */ jsxs("p", { className: "qquote", children: [
            "\u201C",
            q,
            "\u201D"
          ] }),
          /* @__PURE__ */ jsx("p", { className: "sub2", children: "\uBB3C\uC74C\uC744 \uB9C8\uC74C\uC5D0 \uBD99\uB4E4\uACE0 \u2014 \uB3D9\uC804 \uC14B, \uC5EC\uC12F \uBC88." }),
          /* @__PURE__ */ jsxs("div", { className: "coinstage", children: [
            tossing && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "coin fly" }),
              /* @__PURE__ */ jsx("span", { className: "coin fly c2" }),
              /* @__PURE__ */ jsx("span", { className: "coin fly c3" })
            ] }),
            !tossing && tosses.length > 0 && /* @__PURE__ */ jsx("p", { className: "coins", children: tosses[tosses.length - 1].coins.map((c, i) => /* @__PURE__ */ jsx("span", { children: c === 3 ? "\u25CF \uC55E" : "\u25CB \uB4A4" }, i)) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "hexlines", children: tosses.map((l, idx) => /* @__PURE__ */ jsxs("div", { className: "hline on drop", children: [
            l.v % 2 ? /* @__PURE__ */ jsx("span", { className: "yang" }) : /* @__PURE__ */ jsx("span", { className: "yin" }),
            (l.v === 6 || l.v === 9) && /* @__PURE__ */ jsx("i", { className: "mv", children: "\u25CF" })
          ] }, idx)) }),
          tosses.length < 6 ? /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { className: "btn gold", onClick: toss, disabled: busy || tossing, children: tossing ? "\uB3D9\uC804\uC774 \uACF5\uC911\uC5D0\u2026" : `\uB3D9\uC804\uC744 \uB358\uC9C4\uB2E4 (${tosses.length}/6)` }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost", onClick: tossAll, disabled: busy || tossing, children: "\uD55C \uBC88\uC5D0 \uB358\uC9C0\uAE30" })
          ] }) : /* @__PURE__ */ jsx("p", { className: "sub2 mt", children: busy ? "\uC870\uAC01\uB4E4\uC774 \uD569\uC758\uD558\uB294 \uC911\u2026" : hexInfo && /* @__PURE__ */ jsxs(Fragment, { children: [
            "\uAD18\uAC00 \uB9FA\uD614\uC5B4 \u2014 ",
            /* @__PURE__ */ jsx("b", { children: hexInfo.name }),
            hexInfo.moving.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              " \xB7 \uAE30\uC6B4\uC740 ",
              /* @__PURE__ */ jsx("b", { children: hexInfo.toName }),
              " \uCABD\uC73C\uB85C \uC6C0\uC9C1\uC774\uACE0 \uC788\uC5B4"
            ] })
          ] }) }),
          !busy && !tossing && tosses.length < 6 && /* @__PURE__ */ jsx("button", { className: "resetlink", onClick: () => {
            setRitual(false);
            setTosses([]);
            setHexInfo(null);
          }, children: "\uBB3C\uC74C\uC744 \uACE0\uCE60\uB798" })
        ] }),
        err && /* @__PURE__ */ jsxs("div", { className: "fade", children: [
          /* @__PURE__ */ jsx("p", { className: "err", children: err }),
          ritual && tosses.length === 6 && !res && !busy && /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { className: "btn gold", onClick: () => judge(hexInfo), children: "\uB2E4\uC2DC \uCCAD\uD558\uAE30" }),
            /* @__PURE__ */ jsx("button", { className: "btn ghost", onClick: () => {
              setErr("");
              setRitual(false);
              setTosses([]);
              setHexInfo(null);
            }, children: "\uC9C8\uBB38\uC744 \uACE0\uCE60\uB798" })
          ] })
        ] })
      ] }),
      res && !cardOn && /* @__PURE__ */ jsx("div", { className: "gateflash" }),
      res && cardOn && /* @__PURE__ */ jsx("button", { className: "escx", onClick: backToLobby, "aria-label": "\uB2EB\uAE30", children: "\u2715" }),
      res && cardOn && /* @__PURE__ */ jsx("div", { className: "persp cardIn", onClick: () => {
        if (why && (detailBusy || detail && !detail._err)) setFlip((f) => !f);
      }, children: /* @__PURE__ */ jsxs("div", { className: "vcard", style: { transform: `rotateY(${flip ? 180 : 0}deg)` }, children: [
        /* @__PURE__ */ jsxs("div", { className: "vface", children: [
          /* @__PURE__ */ jsx("i", { className: "corner tl", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner tr", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner bl", children: "\u2726" }),
          /* @__PURE__ */ jsx("i", { className: "corner br", children: "\u2726" }),
          /* @__PURE__ */ jsx("span", { className: "vside", children: "\u904B\u547D\u5408\u610F\u5224\u6C7A" }),
          /* @__PURE__ */ jsx("span", { className: `vseal ${why ? "faded" : ""}`, children: "\u795E" }),
          /* @__PURE__ */ jsxs("div", { className: "vtop", children: [
            /* @__PURE__ */ jsx("span", { children: "BINARI" }),
            /* @__PURE__ */ jsx("span", { children: CAT_LABEL[res.category] || "\uC5B4\uB290 \uBB3C\uC74C" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: `vq ${q.length > 55 ? "s" : ""}`, children: q }),
          /* @__PURE__ */ jsx("div", { className: "vdiv", children: /* @__PURE__ */ jsx("span", { children: "\u2726" }) }),
          res.total > 0 && res.against > 0 && res.against / res.total >= 0.4 && /* @__PURE__ */ jsxs("p", { className: "split", children: [
            "\uC9C0\uD45C\uAC00 \uAC08\uB77C\uC130\uB2E4 \xB7 ",
            res.total - res.against,
            " : ",
            res.against
          ] }),
          /* @__PURE__ */ jsx("p", { className: `vv ${res.direction === "GO" ? "go" : res.direction === "HOLD" ? "hold" : ""} ${(res.verdict || "").length > 40 ? "s" : (res.verdict || "").length > 22 ? "m" : ""}`, children: res.verdict }),
          !why ? /* @__PURE__ */ jsx("button", { className: "whybtn", onClick: (e) => {
            e.stopPropagation();
            track("why_opened");
            setWhy(true);
          }, children: "\uC65C \uC774\uB807\uAC8C \uBD24\uC5B4?" }) : /* @__PURE__ */ jsxs("div", { className: "l2 fade", children: [
            detail && !detail._err ? /* @__PURE__ */ jsxs("p", { className: "vs", children: [
              '"',
              detail.subline,
              '"'
            ] }) : detailBusy ? /* @__PURE__ */ jsx("p", { className: "vs dim", children: "\uC218\uD638\uC2E0\uC774 \uC774\uC720\uB97C \uACE0\uB974\uB294 \uC911\u2026" }) : /* @__PURE__ */ jsxs("p", { className: "vs dim", children: [
              "\u2014 \uC774\uC720\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4 \u2014",
              /* @__PURE__ */ jsx("button", { className: "retrybtn", onClick: (e) => {
                e.stopPropagation();
                if (detailArgsRef.current) {
                  setDetail(null);
                  fetchDetail(...detailArgsRef.current, true);
                }
              }, children: "\uB2E4\uC2DC \uC2DC\uB3C4" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "pips", children: [
              [...Array(res.total || 0)].map((_, i) => /* @__PURE__ */ jsx("span", { className: `pip ${i < pipLit ? "on" : ""}` }, i)),
              /* @__PURE__ */ jsxs("em", { children: [
                res.total,
                "\uAC1C \uC911 ",
                pipLit,
                "\uAC1C ",
                res.direction === "HOLD" ? "\uAC08\uB9BC" : "\uAC19\uC740 \uCABD"
              ] })
            ] }),
            detail && !detail._err && detail.funLine && /* @__PURE__ */ jsxs("p", { className: "vfun", children: [
              "\uC815\uB839 \u2014 ",
              detail.funLine
            ] }),
            (detailBusy || detail && !detail._err) && /* @__PURE__ */ jsxs("div", { className: "vbot", children: [
              /* @__PURE__ */ jsx("span", { children: "\uC6B4\uBA85 \uD569\uC758 \uD310\uACB0" }),
              /* @__PURE__ */ jsx("span", { children: "\uCE74\uB4DC \uD0ED \u2192 \uC9C0\uD45C\uBCC4 \uADFC\uAC70" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vface back", children: [
          /* @__PURE__ */ jsxs("div", { className: "vtop", children: [
            /* @__PURE__ */ jsx("span", { children: "\uD310\uACB0 \uADFC\uAC70" }),
            /* @__PURE__ */ jsx("span", { children: "\uD0ED \u2192 \uB3CC\uC544\uAC00\uAE30" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "vscroll", children: [
            hexInfo && /* @__PURE__ */ jsxs("p", { className: "vhex", children: [
              "\u5366 ",
              hexInfo.name,
              hexInfo.moving.length > 0 && ` \u2192 ${hexInfo.toName}`
            ] }),
            detail?.reasons ? /* @__PURE__ */ jsx("ul", { className: "vr", children: detail.reasons.map((r, i) => /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("b", { children: r.axis }),
              r.vote && /* @__PURE__ */ jsx("em", { className: "vote", children: r.vote }),
              /* @__PURE__ */ jsx("p", { children: r.text })
            ] }, i)) }) : /* @__PURE__ */ jsxs("p", { className: "gathering", children: [
              "\uC870\uAC01\uB4E4\uC774 \uADFC\uAC70\uB97C \uBAA8\uC73C\uACE0 \uC788\uC5B4",
              /* @__PURE__ */ jsxs("span", { className: "dots", children: [
                /* @__PURE__ */ jsx("i", { children: "." }),
                /* @__PURE__ */ jsx("i", { children: "." }),
                /* @__PURE__ */ jsx("i", { children: "." })
              ] })
            ] }),
            saju && saju.idx && /* @__PURE__ */ jsx(MyeongsikReport, { saju, sex: birth.sex, birth }),
            detail?.disclaimer && /* @__PURE__ */ jsx("p", { className: "disc", children: detail.disclaimer })
          ] })
        ] })
      ] }) }),
      res && cardOn && /* @__PURE__ */ jsx("div", { className: "raterow fade", children: rated ? /* @__PURE__ */ jsx("p", { className: "ratedone", children: "\uACE0\uB9C8\uC6CC \u2014 \uB2F4\uC544\uB480\uC5B4. \uB2E4\uC74C \uD310\uACB0\uC774 \uB354 \uB9DE\uC544\uC9C8 \uAC70\uC57C." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "ratelab", children: "\uC774 \uD310\uACB0, \uC5B4\uB560\uC5B4?" }),
        /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => rateVerdict(1), children: "\uBE57\uB098\uAC14\uC5B4" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => rateVerdict(2), children: "\uAE00\uC384" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => rateVerdict(3), children: "\uB531\uC774\uC57C" })
        ] })
      ] }) }),
      res && cardOn && !belief && /* @__PURE__ */ jsxs("div", { className: "raterow fade", children: [
        /* @__PURE__ */ jsx("span", { className: "ratelab", children: "\uC774\uB7F0 \uAC70, \uC6D0\uB798 \uBBFF\uB294 \uD3B8\uC774\uC57C?" }),
        /* @__PURE__ */ jsx("div", { className: "row gap center", children: [["believer", "\uBBFF\uB294 \uD3B8"], ["mixed", "\uBC18\uBC18"], ["skeptic", "\uC548 \uBBFF\uB294 \uD3B8"]].map(([v, label]) => /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => answerBelief(v), children: label }, v)) })
      ] }),
      res && cardOn && /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: shareVerdict, children: shared ? "\uBCF5\uC0AC\uD588\uC5B4 \u2014 \uBD99\uC5EC\uB123\uC73C\uBA74 \uB3FC" : "\uCE74\uD1A1\xB7\uB77C\uC778\uC73C\uB85C \uD310\uACB0 \uBCF4\uB0B4\uAE30" }),
      res && cardOn && letterOk && (!letter ? /* @__PURE__ */ jsxs("button", { className: "btn ghost mt", onClick: openLetter, children: [
        "\uC218\uD638\uC2E0\uC758 \uC11C\uC2E0 \u2014 \uC774 \uD310\uACB0\uC758 \uAE4A\uC740 \uD480\uC774 \xB7 ",
        LETTER_PRICE.toLocaleString(),
        "\uC6D0"
      ] }) : letterIntent ? /* @__PURE__ */ jsx("p", { className: "ratedone", children: "\uC11C\uC2E0\uC744 \uB9E1\uACBC\uC5B4 \u2014 \uC218\uD638\uC2E0\uC774 \uC4F0\uAE30 \uC2DC\uC791\uD588\uC5B4." }) : /* @__PURE__ */ jsxs("div", { className: "letterwrap fade", children: [
        /* @__PURE__ */ jsxs("p", { className: "dtag", children: [
          "\uC218\uD638\uC2E0\uC758 \uC11C\uC2E0 \xB7 ",
          LETTER_PRICE.toLocaleString(),
          "\uC6D0"
        ] }),
        /* @__PURE__ */ jsx("ul", { className: "letterlist", children: LETTER_SECTIONS.map((t, i) => /* @__PURE__ */ jsx("li", { children: t }, i)) }),
        /* @__PURE__ */ jsx("p", { className: "letterprev", children: letterPreview(saju, hesit) }),
        /* @__PURE__ */ jsx("p", { className: "letterprevtag", children: "\u2014 \uC5EC\uAE30\uAE4C\uC9C0\uAC00 \uBBF8\uB9AC\uBCF4\uAE30\uC57C" }),
        /* @__PURE__ */ jsx("p", { className: "refundnote", children: "\uC11C\uC2E0\uC740 \uC5F4\uC5B4\uBCF4\uB294 \uC21C\uAC04 \uC804\uD574\uC9C0\uB294 \uAE00\uC774\uB77C, \uC5F4\uB78C \uD6C4\uC5D0\uB294 \uD658\uBD88\uB418\uC9C0 \uC54A\uC544\uC694. \uC704 \uBBF8\uB9AC\uBCF4\uAE30\uB85C \uBA3C\uC800 \uD655\uC778\uD574 \uC8FC\uC138\uC694." }),
        /* @__PURE__ */ jsx("button", { className: "btn gold mt", onClick: confirmLetterIntent, children: "\uBC1B\uC744\uAC8C" })
      ] })),
      res && cardOn && !bujeok && /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: () => {
        track("bujeok_opened");
        setBujeok(true);
      }, children: "\uC218\uD638\uC2E0\uC758 \uBD80\uC801 \uBC1B\uAE30" }),
      res && cardOn && bujeok && /* @__PURE__ */ jsxs("div", { className: "fade bwrap", children: [
        /* @__PURE__ */ jsx(BujeokCanvas, { saju, direction: res.direction, seed: q + (res.verdict || "") }),
        /* @__PURE__ */ jsx("p", { className: "fine", children: "\uC624\uB298\uC758 \uD310\uACB0\uC744 \uC9C0\uD0A4\uB294 \uBD80\uC801 \u2014 \uAC19\uC740 \uC9C8\uBB38\xB7\uAC19\uC740 \uD310\uACB0\uC5D0\uC11C\uB9CC \uAC19\uC740 \uBB38\uC591\uC774 \uB098\uC640." }),
        /* @__PURE__ */ jsx("button", { className: "btn ghost sm", onClick: () => saveOrShareBujeok({ saju, direction: res.direction, seed: q + (res.verdict || ""), tosses, hexInfo, category: res.category, against: res.against || 0, total: res.total || 0 }), children: "\uBD80\uC801 \uAC04\uC9C1\uD558\uAE30 \u2014 \uC774\uBBF8\uC9C0\uB85C" }),
        /* @__PURE__ */ jsx("p", { className: "fine", children: "\uC9C8\uBB38\uC740 \uC774\uBBF8\uC9C0\uC5D0 \uB2F4\uAE30\uC9C0 \uC54A\uC544 \u2014 \uBB38\uC591\uACFC \uD310\uACB0\uC758 \uBC29\uD5A5\uB9CC." })
      ] }),
      res && cardOn && /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: backToLobby, children: "\uB2E4\uB978 \uAC78 \uBB3C\uC5B4\uBCFC\uB798" }),
      res && cardOn && /* @__PURE__ */ jsx("p", { className: "ainote card", children: "\uC774 \uD310\uACB0\uC740 AI\uAC00 \uC0DD\uC131\uD55C \uB0B4\uC6A9\uC785\uB2C8\uB2E4" })
    ] }),
    letterStage && /* @__PURE__ */ jsxs("div", { className: "sealwrap", role: "status", "aria-live": "polite", children: [
      /* @__PURE__ */ jsxs("div", { className: "sealfx", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("i", { className: "sring s1" }),
        /* @__PURE__ */ jsx("i", { className: "sring s2" }),
        /* @__PURE__ */ jsx("i", { className: "sring s3" }),
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => /* @__PURE__ */ jsx("i", { className: "spark", style: { "--a": `${i * 45}deg`, animationDelay: `${i * 0.13}s` } }, i)),
        /* @__PURE__ */ jsx("b", { className: "sealcore", children: "\u66F8" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "sealline " + letterStage, children: letterStage === "seal" ? LETTER_SEAL_LINE : LETTER_WAIT_LINE })
    ] }),
    imprintOpen && /* @__PURE__ */ jsxs("div", { className: "readwrap", children: [
      /* @__PURE__ */ jsx("button", { className: "escx", onClick: () => setImprintOpen(false), "aria-label": "\uB2EB\uAE30", children: "\u2715" }),
      /* @__PURE__ */ jsxs("div", { className: "readbody", children: [
        /* @__PURE__ */ jsx(GuardianSeal, { saju, zo, mbti, num, moon, birth, kind: "\uAC01\uC778 \u2014 \uC0AC\uB78C \uC790\uCCB4\uC5D0 \uB538\uB9B0 \uBB38\uC11C" }),
        /* @__PURE__ */ jsx(ImprintDoc, { saju, birth, sex: birth?.sex, onClose: () => setImprintOpen(false) })
      ] })
    ] }),
    letterOpen && letterDoc && !letterDoc._err && /* @__PURE__ */ jsxs("div", { className: "readwrap", children: [
      /* @__PURE__ */ jsx("button", { className: "escx", onClick: () => setLetterOpen(false), "aria-label": "\uB2EB\uAE30", children: "\u2715" }),
      /* @__PURE__ */ jsxs("div", { className: "readbody", children: [
        /* @__PURE__ */ jsx(GuardianSeal, { saju, zo, mbti, num, moon, birth, kind: `\uC11C\uC2E0 \xB7 ${letterNo(records[letterIdx] || {})}` }),
        letterDoc.chapters.map((c, i) => /* @__PURE__ */ jsxs("div", { className: "rchap", children: [
          /* @__PURE__ */ jsxs("h3", { className: "rct", children: [
            /* @__PURE__ */ jsx("span", { children: i + 1 }),
            c.t
          ] }),
          /* @__PURE__ */ jsx("p", { className: "rcb", children: c.body })
        ] }, i)),
        letterDoc.closing && /* @__PURE__ */ jsx("p", { className: "rclose", children: letterDoc.closing }),
        /* @__PURE__ */ jsx("div", { className: "raterow", children: letterRated ? /* @__PURE__ */ jsx("p", { className: "ratedone", children: "\uB2F4\uC544\uB480\uC5B4 \u2014 \uB2E4\uC74C \uC11C\uC2E0\uC774 \uB354 \uB098\uC544\uC9C8 \uAC70\uC57C." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("span", { className: "ratelab", children: [
            "\uC774 \uC11C\uC2E0, ",
            LETTER_PRICE.toLocaleString(),
            "\uC6D0 \uAC12 \uD588\uC5B4?"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "row gap center", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => rateLetter(1), children: "\uC544\uB2C8" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "calbtn sm", onClick: () => rateLetter(2), children: "\uAC12\uD588\uC5B4" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: saveLetterFile, children: "\uC11C\uC2E0 \uAC04\uC9C1\uD558\uAE30 \u2014 \uD30C\uC77C\uB85C" }),
        /* @__PURE__ */ jsxs("p", { className: "fine", children: [
          "\uC11C\uC2E0\uD568(\uD648)\uC5D0\uC11C \uC5B8\uC81C\uB4E0 \uB2E4\uC2DC \uC5F4\uB824. \uAE30\uAE30\uAC00 \uBC14\uB00C\uC5B4\uB3C4 \uBC88\uD638 ",
          /* @__PURE__ */ jsx("b", { children: letterNo(records[letterIdx] || {}) }),
          "\uB85C \uB2E4\uC2DC \uBC1B\uC744 \uC218 \uC788\uC5B4."
        ] }),
        /* @__PURE__ */ jsx("p", { className: "ainote", children: "\uC774 \uC11C\uC2E0\uC740 AI\uAC00 \uC0DD\uC131\uD55C \uB0B4\uC6A9\uC785\uB2C8\uB2E4 \xB7 \uC7AC\uBBF8\uB85C \uBCF4\uB294 \uCC38\uACE0\uC6A9\uC774\uC57C" }),
        /* @__PURE__ */ jsx("button", { className: "btn ghost mt", onClick: () => setLetterOpen(false), children: "\uC811\uC5B4\uB458\uAC8C" })
      ] })
    ] })
  ] });
}
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap');
*{box-sizing:border-box} 
.stage{min-height:100vh;background:radial-gradient(130% 100% at 50% 0%,#141021,#0a0812 55%,#050408);color:#d8cfe6;font-family:'Noto Serif KR',serif;display:flex;justify-content:center;padding:26px 20px 70px;position:relative;overflow:hidden}
.stage::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 12% 22%,#ffffff55,transparent),radial-gradient(1px 1px at 78% 14%,#ffe9ad44,transparent),radial-gradient(1.5px 1.5px at 62% 68%,#ffffff33,transparent),radial-gradient(1px 1px at 30% 84%,#ffe9ad33,transparent),radial-gradient(1px 1px at 88% 48%,#ffffff40,transparent),radial-gradient(1.5px 1.5px at 8% 58%,#ffe9ad2e,transparent);animation:twk 6s ease-in-out infinite alternate}
@keyframes twk{to{opacity:.45}}
.scene{width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;word-break:keep-all}
/* v99: \uC2A4\uD15D\uD615 \uD654\uBA74\uC740 \uC138\uB85C \uC911\uC559 \uC815\uB82C \u2014 \uD558\uB2E8 35~45%\uAC00 \uBE44\uACE0 CTA\uAC00 \uD654\uBA74 \uC911\uC559\uC5D0 \uB728\uB358 \uAC83\uC744 \uC815\uB9AC */
.scene.stepv{justify-content:center;min-height:calc(100dvh - 96px)}
.line,.sub2,.mention,.dimq,.gsay,.gintro,.forming,.vv,.vs,.vq,.qquote,.dmain,.gname,.vlogverdict{text-wrap:balance}
.fade{animation:fd 1.15s cubic-bezier(.22,.7,.25,1) both}@keyframes fd{from{opacity:0;transform:translateY(14px) scale(.985);filter:blur(7px)}to{opacity:1;transform:none;filter:blur(0)}}
.orb{position:relative;width:170px;height:170px;margin:20px 0 28px;filter:drop-shadow(0 0 24px rgba(245,217,139,.2))}
.line{font-size:17px;line-height:1.8;margin:8px 0;opacity:0;animation:fd 1.6s cubic-bezier(.22,.7,.25,1) forwards}.d1{animation-delay:1.4s}.d2{animation-delay:3s}
.brand-mark{margin-top:56px;font-size:11px;letter-spacing:.4em;color:#8a7f95;font-family:sans-serif}
.verbadge{position:fixed;right:9px;bottom:7px;z-index:70;font-family:sans-serif;font-size:9px;letter-spacing:.08em;color:#575070;pointer-events:none;user-select:none}
.title{font-size:20px;font-weight:600;color:#f0e2b8;margin:6px 0 4px}
.sub2{font-size:14px;color:#9d8fb5;line-height:1.7;margin:6px 0 18px}
.form{display:flex;flex-direction:column;gap:12px;width:100%;margin-bottom:14px}
.row{display:flex;align-items:center;justify-content:center}.gap{gap:8px}.center{justify-content:center}
.in{background:transparent;border:none;border-bottom:1px solid rgba(245,217,139,.45);color:#fff3d4;font-weight:600;padding:10px 4px;font-size:19px;width:96px;text-align:center;font-family:inherit;letter-spacing:.06em;transition:border-color .3s, box-shadow .3s}
.in::placeholder{color:#5c5470;font-weight:400}
/* v99: \uC774\uB984\xB7\uB3C4\uC2DC\uCC98\uB7FC \uC790\uC720\uC785\uB825 \uCE78\uC740 \uBC11\uC904\uC774 \uC544\uB2C8\uB77C \uBC15\uC2A4\uB85C(\uC9C8\uBB38\uCE78\uACFC \uAC19\uC740 \uC5B4\uD3EC\uB358\uC2A4) */
.in.box{background:rgba(16,12,26,.72);border:1px solid rgba(245,217,139,.34);border-radius:12px;padding:13px 14px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.in.box:focus{outline:none;border-color:rgba(245,217,139,.7);box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 16px rgba(245,217,139,.18)}
/* v99: \uB123\uC740 \uAC12\uC744 \uC0AC\uB78C \uB9D0\uB85C \uB418\uC77D\uC5B4 \uC900\uB2E4 \u2014 \uB9CC\uC138\uB825 \uC815\uD655\uB3C4\uAC00 \uD654\uBA74\uC5D0\uC11C \uBCF4\uC774\uAC8C */
/* v105.5: \uC2A4\uD0B5\uC740 \uB20C\uB9AC\uB418 \uAD8C\uD558\uC9C0 \uC54A\uB294\uB2E4 \u2014 \uC0C9\uC744 \uBE7C '\uC544\uC9C1 \uCC28\uB840\uAC00 \uC544\uB2CC' \uC0C1\uD0DC\uB85C \uBCF4\uC774\uAC8C */
.btn.ghost.quiet{border-color:rgba(140,132,158,.24);background:rgba(255,255,255,.015);color:#7c7590;box-shadow:none;font-weight:500}
.btn.ghost.quiet:hover{border-color:rgba(190,182,205,.4);color:#a9a2bd;box-shadow:none}
/* \uD55C\uC790 \uC774\uB984 \uB178\uD06C \u2014 \uCCAD\uD558\uB294 \uC0AC\uB78C\uC5D0\uAC8C\uB9CC \uC5F4\uB9B0\uB2E4 */
.knocklink{background:none;border:none;margin:-4px 0 0;padding:4px 6px;color:#8a819f;font-family:inherit;font-size:12px;letter-spacing:.04em;cursor:pointer;text-decoration:underline dotted;text-underline-offset:4px}
.knocklink:hover{color:#cfc4de}
.in.box.hanja{font-size:17px;letter-spacing:.12em}
/* v124.1 \uC778\uC7A5 \u2014 \uC720\uB8CC \uBB38\uC11C \uBA38\uB9AC. \uBB38\uC11C\uAC00 \uAE00\uC774\uBBC0\uB85C \uC778\uC7A5\uC740 \uC870\uC6A9\uD574\uC57C \uD55C\uB2E4(\uC624\uBE0C 108px + \uB450 \uC904) */
.gsealwrap{display:flex;flex-direction:column;align-items:center;gap:2px;margin:0 0 22px;padding-bottom:18px;border-bottom:1px solid rgba(245,217,139,.14)}
.gsealorb{width:132px;height:132px;border-radius:50%;border:1px solid;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 50%,rgba(12,9,20,.55),rgba(5,4,8,.9))}
.gsealinner{transform:scale(.58);transform-origin:center;opacity:.92}
.gsealline{margin:10px 0 0;font-size:13.5px;color:#f0e2b8;letter-spacing:.04em}
.gsealkind{margin:2px 0 0;font-family:sans-serif;font-size:10.5px;letter-spacing:.12em;color:#8a7f95;text-transform:none}
.confirmline{font-size:12.5px;color:#c9bb96;letter-spacing:.02em;margin:2px 0 0;padding:7px 14px;border:1px dashed rgba(245,217,139,.28);border-radius:10px;background:rgba(245,217,139,.045)}
.in::placeholder{color:#4d445f}
.in.sm{width:60px}.in.wide{width:100%;text-align:center;font-size:15px}
.in:focus{outline:none;border-bottom-color:#ffe9ad;box-shadow:0 12px 18px -14px rgba(245,217,139,.6)}
.in:disabled{opacity:.35}
.unit{color:#6f6580;font-size:12.5px}
.chk{font-family:sans-serif;font-size:12px;color:#c9b98f;display:flex;align-items:center;gap:6px}.chk em{color:#8a7f95;font-style:normal}
.caltoggle{align-items:center}
.calbtn{font-family:inherit;font-size:13px;padding:7px 18px;border-radius:999px;border:1px solid rgba(138,127,149,.35);background:transparent;color:#9d8fb5;cursor:pointer;transition:all .2s}
.calbtn.on{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 12px rgba(245,217,139,.25)}
.calbtn.sm{font-size:12px;padding:5px 13px}
.row.wrap{flex-wrap:wrap;max-width:340px;gap:6px}
.ctxsep{width:120px;height:1px;background:linear-gradient(90deg,transparent,rgba(245,217,139,.3),transparent);margin:16px auto 2px}
.ctxblock{display:flex;flex-direction:column;align-items:center;gap:7px;margin-top:2px}
.ctxhead{font-size:14px;color:#d3c199;letter-spacing:.03em;margin:0;text-wrap:balance;text-shadow:0 0 12px rgba(245,217,139,.25)}
.ctxlab{color:#8a7f95;letter-spacing:.06em;margin:1px 0 3px}
.consent{display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:16px}
.consent .fine{margin-top:6px}
.plink{color:#c9a24b;text-decoration:underline}
.hesitrow{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:8px}
.bscene{display:flex;flex-direction:column;gap:14px;align-items:center;width:100%;margin-top:6px}
.in.center{text-align:center}
.lateIn{opacity:0;animation:fd 1.6s cubic-bezier(.22,.7,.25,1) 4.4s forwards}
.rvlunar{display:block;font-size:11.5px;font-family:sans-serif;letter-spacing:.12em;color:#9d8fb5;margin-top:7px;font-style:normal}
.addpanel{display:flex;flex-direction:column;gap:10px;align-items:center;margin:2px 0 14px;width:100%}
.gathering{font-size:13.5px;color:#c9b98f;text-align:center;margin:30px 0}
.gathering .dots i{animation:blinkDot 1.2s infinite;font-style:normal}
.gathering .dots i:nth-child(2){animation-delay:.35s}.gathering .dots i:nth-child(3){animation-delay:.7s}
@keyframes blinkDot{0%,100%{opacity:.15}50%{opacity:1}}
.chk input{accent-color:#c98f3d}
.btn{font-family:inherit;font-size:14px;font-weight:600;letter-spacing:.14em;padding:13px 28px;border-radius:999px;border:1px solid rgba(245,217,139,.4);background:transparent;color:#f0e2b8;cursor:pointer;transition:box-shadow .3s,border-color .3s,background .3s,transform .1s}
.btn.gold{background:linear-gradient(180deg,#f5d98b,#c98f3d);color:#241a08;border:none;box-shadow:0 6px 22px rgba(201,143,61,.3)}
.btn.ghost{border-color:rgba(245,217,139,.32);background:rgba(245,217,139,.05);color:#d6c493;box-shadow:0 2px 14px rgba(0,0,0,.28)}.btn:hover{border-color:rgba(245,217,139,.7);box-shadow:0 0 16px rgba(245,217,139,.2)}.btn.gold:hover{box-shadow:0 8px 26px rgba(201,143,61,.45)}.btn:active{transform:translateY(1px)}.btn:disabled{opacity:.45;cursor:default}.mt{margin-top:18px}
.fine{font-family:sans-serif;font-size:11px;color:#6b617d;margin-top:14px;line-height:1.6}
/* AI\uAE30\uBCF8\uBC95 \uC81C31\uC870 \u2014 \uC0DD\uC131\uD615 AI \uC0AC\uC804 \uACE0\uC9C0\xB7\uACB0\uACFC\uBB3C \uD45C\uC2DC(\uBCC4\uC9C0 \uC794\uAE00\uC528, \uD310\uACB0\uBB38 \uD615\uC2DD \uBD88\uBCC0) */
.ainote{font-family:sans-serif;font-size:10.5px;color:#6b617d;line-height:1.6;margin-top:14px;text-align:center}
/* \uC9C0\uC2DC\uC11C 5\xB76: \uC11C\uC2E0 \uAC00\uACA9\xB7\uBBF8\uB9AC\uBCF4\uAE30 \uBCC4\uC9C0 \uB808\uC774\uC5B4(\uD310\uACB0 \uCE74\uB4DC \uAD6C\uC870 \uBD88\uBCC0) */
.letterwrap{margin-top:20px;padding:18px 16px;border:1px solid rgba(245,217,139,.22);border-radius:14px;background:rgba(20,15,34,.55);text-align:center;max-width:330px}
.letterlist{list-style:none;padding:0;margin:10px 0 0;font-size:12.5px;line-height:1.9;color:#cfc4e2}
.letterlist li::before{content:'\xB7 ';color:#c9b98f}
.letterprev{font-size:13px;line-height:1.85;color:#e2d9f2;margin:14px 0 0;text-align:left;overflow-wrap:anywhere}
.letterprevtag{font-family:sans-serif;font-size:10.5px;color:#8a7f95;margin:6px 0 0}
.refundnote{font-size:12px;line-height:1.7;color:#e5b96b;margin:14px 0 0;padding:9px 10px;border:1px solid rgba(229,185,107,.35);border-radius:9px}
/* v104: \uC11C\uC2E0 \uB300\uAE30 \uC5F0\uCD9C(\uBD09\uC778 5\uCD08 \u2192 \uB300\uAE30 \uBB38\uAD6C 2\uCD08). \uC804\uBD80 CSS \uC560\uB2C8\uBA54\uC774\uC158 \u2014 \uC790\uBC14\uC2A4\uD06C\uB9BD\uD2B8 \uB8E8\uD504\uB97C \uB3CC\uB9AC\uC9C0 \uC54A\uB294\uB2E4. */
.sealwrap{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;background:radial-gradient(120% 80% at 50% 42%,#1c1330,#0b0817 56%,#050308);animation:fd .5s ease both}
.sealfx{position:relative;width:190px;height:190px;display:flex;align-items:center;justify-content:center}
.sring{position:absolute;inset:0;margin:auto;width:96px;height:96px;border-radius:50%;border:1px solid rgba(245,217,139,.55);opacity:0;animation:sealRing 2.6s cubic-bezier(.2,.65,.3,1) infinite}
.sring.s2{animation-delay:.85s}.sring.s3{animation-delay:1.7s}
.spark{position:absolute;left:50%;top:50%;width:2px;height:34px;margin:-17px 0 0 -1px;border-radius:2px;background:linear-gradient(to top,transparent,rgba(255,233,173,.95));transform:rotate(var(--a)) translateY(-58px);transform-origin:50% 50%;animation:sealSpark 2.2s ease-in-out infinite}
.sealcore{position:relative;font-family:'Noto Serif KR',serif;font-size:42px;font-weight:900;color:#ffe9ad;text-shadow:0 0 30px rgba(245,217,139,.75),0 0 70px rgba(245,217,139,.35);animation:sealCore 2.6s ease-in-out infinite}
.sealline{font-family:'Noto Serif KR',serif;font-size:15px;letter-spacing:.14em;color:#e8dcc0;margin:0;text-align:center;text-shadow:0 0 18px rgba(245,217,139,.4)}
.sealline.seal{animation:formPulse 2.1s ease-in-out infinite}
.sealline.wait{font-size:17px;color:#ffe9ad;animation:fd .7s cubic-bezier(.22,.7,.25,1) both}
@keyframes sealRing{0%{opacity:0;transform:scale(.45)}18%{opacity:.85}100%{opacity:0;transform:scale(2.05)}}
@keyframes sealSpark{0%,100%{opacity:.15;transform:rotate(var(--a)) translateY(-52px) scaleY(.6)}50%{opacity:.9;transform:rotate(var(--a)) translateY(-70px) scaleY(1.15)}}
@keyframes sealCore{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.09);opacity:1}}
@media (prefers-reduced-motion:reduce){.sring,.spark,.sealcore,.sealline.seal{animation:none}.spark{opacity:.35}}
/* v105: \uC11C\uC2E0\uD568(\uB85C\uBE44) + \uC11C\uC2E0 \uC804\uBB38 \uC77D\uAE30 \uD654\uBA74 */
.mailbox{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:8px;animation:mailIn .8s cubic-bezier(.22,.7,.25,1) both}
@keyframes mailIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
.mailbox .btn{animation:mailPulse 2.6s ease-in-out 1s infinite}
@keyframes mailPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,217,139,0)}50%{box-shadow:0 0 22px 2px rgba(245,217,139,.28)}}
.gsay.writing{color:#c9b98f;animation:formPulse 2.2s ease-in-out infinite}
.lbox{margin-top:12px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:8px}
.lboxrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(245,217,139,.2);border-radius:12px;background:rgba(20,15,34,.5);text-align:left}
.lboxtxt{flex:1;min-width:0}
.lboxq{margin:0;font-size:12.5px;color:#e2d9f2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lboxno{margin:3px 0 0;font-family:sans-serif;font-size:10px;letter-spacing:.06em;color:#8a7f95}
.lboxrow .btn{flex:none;padding:7px 14px;font-size:11.5px;letter-spacing:.06em}
@media (prefers-reduced-motion:reduce){.mailbox,.mailbox .btn,.gsay.writing{animation:none}}
.readwrap{position:fixed;inset:0;z-index:75;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(120% 74% at 50% 10%,#171029,#0b0817 58%,#060409)}
.readbody{max-width:520px;margin:0 auto;padding:calc(58px + env(safe-area-inset-top,0px)) 22px calc(48px + env(safe-area-inset-bottom,0px));text-align:center}
.dtag.center{text-align:center}
.rchap{margin-top:26px;text-align:left}
.rct{display:flex;align-items:baseline;gap:9px;margin:0 0 9px;font-size:14.5px;font-weight:600;color:#ffe9ad;letter-spacing:.02em;text-shadow:0 0 18px rgba(245,217,139,.3)}
.rct span{font-family:sans-serif;font-size:10px;letter-spacing:.1em;color:#8a7f95;border:1px solid rgba(245,217,139,.3);border-radius:999px;width:19px;height:19px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.rcb{margin:0;font-size:14px;line-height:2.05;color:#ddd3ee;text-align:left;overflow-wrap:anywhere;word-break:keep-all}
.rclose{margin:32px 0 0;font-size:14.5px;line-height:1.9;color:#ffe9ad;letter-spacing:.03em;text-shadow:0 0 20px rgba(245,217,139,.35)}
.readbody .raterow{margin-top:34px}
.readbody .ainote{margin-top:26px}
.ainote.card{margin-top:18px;opacity:.85}
.err{color:#e58a8a;font-size:13px;font-family:sans-serif;margin:10px 0}
.cards{display:flex;flex-direction:column;gap:14px;width:100%;margin-top:10px}
.chips{display:flex;flex-direction:column;gap:8px;width:100%;margin:8px 0 4px;align-items:center}
.chip{font-family:inherit;font-size:12.5px;letter-spacing:.06em;color:#c9b98f;border:1px solid rgba(245,217,139,.3);border-radius:999px;padding:8px 18px;opacity:0;transform:translateY(8px);transition:all .7s ease}
.chip.on{opacity:1;transform:none;animation:chipGlow 1.6s ease}
@keyframes chipGlow{0%{box-shadow:0 0 0 rgba(245,217,139,0)}30%{box-shadow:0 0 18px rgba(245,217,139,.45)}100%{box-shadow:0 0 0 rgba(245,217,139,0)}}
.mention{font-size:14.5px;line-height:1.7;color:#e8dff5;margin:14px 0 4px}
.mention b{color:#ffe9ad;font-weight:600}
.refbox{width:100%;margin:10px 0 4px;font-family:sans-serif;font-size:12px;color:#8a7f95;text-align:left}
.refbox summary{cursor:pointer;text-align:center;letter-spacing:.08em;color:#6f6580;list-style:none}
.refbox summary::after{content:" \u25BE"}
.refbox[open] summary::after{content:" \u25B4"}
.refline{margin:8px 0 0;line-height:1.7;color:#9d8fb5}
.mcard{background:linear-gradient(160deg,#1c1730,#120e1e);border:1px solid rgba(245,217,139,.35);border-radius:14px;padding:16px;opacity:0;transform:rotateX(70deg);transition:all .8s cubic-bezier(.2,.8,.25,1)}
.mcard.on{opacity:1;transform:none}
.mtag{font-family:sans-serif;font-size:10px;letter-spacing:.2em;color:#c9b98f;text-align:left}
.pill{font-size:16px;font-weight:600;color:#f0e2b8;margin:8px 0;text-align:left}
.bars{display:flex;flex-direction:column;gap:4px;margin:8px 0}
.bar{display:flex;align-items:center;gap:6px;font-family:sans-serif;font-size:11px;color:#9d8fb5}
.bar i{height:6px;border-radius:3px;display:block;min-width:4px}.bar b{color:#c9b98f}
.mread{font-size:13.5px;line-height:1.75;color:#cbc0dd;text-align:left;margin:6px 0 0}
.grid16{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;width:100%}
.cell{font-family:inherit;font-size:12.5px;letter-spacing:.08em;padding:11px 0;border-radius:999px;border:1px solid rgba(168,158,185,.55);background:rgba(255,255,255,.02);color:#cfc4de;cursor:pointer;transition:all .25s}
.cell:hover{border-color:rgba(245,217,139,.5)}
.cell.sel{border-color:#ffe9ad;color:#241a08;font-weight:600;background:linear-gradient(180deg,#f5d98b,#d9ad5c);box-shadow:0 0 16px rgba(245,217,139,.35)}
.halo{position:relative;filter:drop-shadow(0 0 30px rgba(245,217,139,.15));margin:8px 0;transition:filter .6s}
.halo.wide{width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);display:flex;justify-content:center;margin-top:calc(min(110vw,57vh,640px)*-0.09);margin-bottom:calc(min(110vw,57vh,640px)*-0.16);transition:filter .6s,transform .9s cubic-bezier(.2,.8,.2,1),opacity .8s ease}
.halo.wide.lobbyscale{transform:translateY(7vh) scale(1.52)}
.halo.wide.dissolved{opacity:0;transform:scale(1.7);filter:blur(7px);pointer-events:none}
.halo.wide.asking{transform:translateY(-5vh) scale(.82);opacity:.96}
.halo.wide.ritualfade{opacity:.1;pointer-events:none;transition:opacity .8s ease}
.residue{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(50% 34% at 50% 36%,var(--elc),transparent 62%);opacity:.2}
@keyframes residueDrift{0%,100%{opacity:.18;transform:scale(1)}50%{opacity:.4;transform:scale(1.12)}}
.gpanel.asking{position:relative;z-index:1}
.gpanel.asking .gintro.dim2{font-size:16.5px;color:#ede0c2;margin-bottom:16px;text-shadow:0 1px 14px rgba(4,3,10,.9)}
.gpanel.asking .qbox{font-size:19px;padding:20px 16px;min-height:104px}
.scene.lobby{position:relative;min-height:calc(100dvh - 96px);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;background:radial-gradient(80% 52% at 50% 42%,#0a0d1c 0%,#060815 50%,rgba(3,4,10,0) 100%)}
.lobbypanel{position:absolute;left:0;right:0;bottom:calc(14vh + env(safe-area-inset-bottom, 0px));z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 16px}
.wakehint{font-family:sans-serif;font-size:12px;letter-spacing:.16em;color:#d8c79a;margin-top:22px;animation:wakePulse 2.4s ease-in-out infinite;text-shadow:0 1px 10px rgba(4,3,10,.85)}
/* v75: \uACF5\uC720 \uD310\uACB0 \uB79C\uB529 \u2014 \uB9C1\uD06C\uB85C \uB4E4\uC5B4\uC628 \uC0AC\uB78C\uC774 '\uC2E4\uC81C \uD310\uACB0 \uCE74\uB4DC'\uB97C \uADF8\uB300\uB85C \uBCF8\uB2E4 */
.sharedwrap{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:34px 20px;background:radial-gradient(120% 78% at 50% 14%,#161029,#0b0817 58%,#060409);text-align:center;overflow-y:auto}
.sharedeyebrow{font-family:sans-serif;font-size:11px;letter-spacing:.24em;color:#b7a7d6;margin:0 0 16px}
.sharedcard{margin-top:0}
.sharedcard .vv{margin-top:6px}
.sharedsub{font-size:13px;line-height:1.7;color:#c3b6d8;margin:16px 4px 0;overflow-wrap:anywhere}
.sharedcta{margin-top:34px}
.sharedfoot{margin-top:26px;font-size:10.5px;letter-spacing:.32em;color:#7c7290;font-family:sans-serif}
/* v75: \uD310\uACB0 \uD3C9\uAC00 \uD589 */
.raterow{display:flex;flex-direction:column;align-items:center;gap:9px;margin-top:24px}
.ratelab{font-family:sans-serif;font-size:11.5px;letter-spacing:.12em;color:#b3a9c8}
.ratedone{font-size:12.5px;letter-spacing:.03em;color:#9a8fb5;margin:6px 0 0;animation:fd .6s cubic-bezier(.22,.7,.25,1) both}
@keyframes wakePulse{0%,100%{opacity:.4}50%{opacity:.95}}
.escx{position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:30;width:40px;height:40px;border-radius:50%;border:1px solid rgba(245,217,139,.3);background:rgba(10,8,18,.55);color:#c9b98f;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);-webkit-tap-highlight-color:transparent;transition:all .2s}
.escx:hover{border-color:#ffe9ad;color:#ffe9ad}
.leanrow{margin:-4px 0 12px;display:flex;flex-direction:column;align-items:center;gap:7px}
.leanlab{font-family:sans-serif;font-size:11px;letter-spacing:.12em;color:#8a7f95}
.payrow{display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap}
.memrow{display:flex;gap:18px;justify-content:center}
.halo.busy{animation:haloPulse 1.4s ease-in-out infinite}
@keyframes haloPulse{0%,100%{filter:drop-shadow(0 0 26px rgba(245,217,139,.14))}50%{filter:drop-shadow(0 0 46px rgba(245,217,139,.34))}}
.halo.dimmed{opacity:.32;filter:blur(2px) drop-shadow(0 0 30px rgba(245,217,139,.2));transition:opacity .6s,filter .6s}
.gintro{font-size:15px;line-height:1.8;margin:4px 0;color:#e0d6ef}.gintro.dim{color:#9d8fb5;font-size:14px;margin-bottom:14px}
.qbox{width:100%;background:rgba(16,12,26,.82);border:1px solid rgba(245,217,139,.45);border-radius:14px;color:#f0e2b8;padding:14px 14px;font-size:16px;font-family:inherit;resize:none;line-height:1.6;margin-bottom:14px;text-align:center;transition:border-color .3s,box-shadow .3s;box-shadow:0 8px 28px rgba(0,0,0,.5)}
.qbox::placeholder{color:#8a7f95}
.qbox:focus{outline:none;border-color:#ffe9ad;box-shadow:0 0 0 2px rgba(245,217,139,.22),0 8px 28px rgba(0,0,0,.5)}
.w100{width:100%;display:flex;flex-direction:column;align-items:center}
.gtext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none;padding:0 34px}
.gtext.up{padding-bottom:150px}
.gpanel{position:relative;margin:-12px auto 0;width:min(92vw,430px);display:flex;flex-direction:column;align-items:center;z-index:3;padding:0 4px}
.gpanel::before{content:"";position:absolute;left:50%;top:-28px;transform:translateX(-50%);width:120%;max-width:540px;height:170px;background:radial-gradient(ellipse 60% 100% at 50% 42%,rgba(6,4,12,.9),rgba(6,4,12,.46) 45%,transparent 70%);z-index:-1;pointer-events:none}
.forming{font-size:13px;line-height:2.1;color:#cfc4e2;letter-spacing:.14em;margin:0;text-shadow:0 0 16px rgba(245,217,139,.4);animation:formPulse 2.1s ease-in-out infinite;background:rgba(5,4,8,.45);padding:10px 18px;border-radius:14px}
.formwrap{display:flex;flex-direction:column;align-items:center;gap:14px}
.formsteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;text-align:left;min-width:220px}
.formsteps li{font-size:11.5px;letter-spacing:.06em;color:#5b5470;transition:color .5s,transform .5s;transform:translateY(1px)}
.formsteps li.done{color:#8a7fa6}
.formsteps li.now{color:#f5d98b;text-shadow:0 0 12px rgba(245,217,139,.5);transform:translateY(0)}
@keyframes formPulse{0%,100%{opacity:.5}50%{opacity:1}}
.gname{font-size:14px;line-height:1.9;color:#f0e2b8;margin:0;text-shadow:0 2px 18px rgba(5,4,8,.95),0 0 26px rgba(245,217,139,.28);background:rgba(5,4,8,.5);padding:8px 16px;border-radius:14px}
.gname.under{background:none;padding:0;margin:2px 0 4px;font-size:15px;letter-spacing:.06em;color:#ffe9ad;text-shadow:0 0 20px rgba(245,217,139,.3)}
.gsay{font-size:14.5px;line-height:1.8;color:#f0e2b8;margin:2px 0 10px;text-align:center;text-shadow:0 1px 12px rgba(4,3,10,.8)}
.gsay.sprite{font-size:12.5px;color:#9d8fb5;margin:-4px 0 10px}
.gsay.born{font-weight:600;color:#ffe9ad;text-shadow:0 0 18px rgba(245,217,139,.35)}
.gintro.dim2{color:#dcc99a;font-size:14px;margin:2px 0 12px;text-shadow:0 1px 12px rgba(4,3,10,.85),0 0 4px rgba(4,3,10,.7)}
.hexpanel{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px;width:100%}
.hexlines{display:flex;flex-direction:column-reverse;gap:8px;margin:6px 0;min-height:88px}
.hline{position:relative;width:86px;height:8px;display:flex;justify-content:center}
.hline .yang{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b,#c98f3d);box-shadow:0 0 10px rgba(245,217,139,.45)}
.hline .yin{width:86px;height:8px;border-radius:4px;background:linear-gradient(90deg,#f5d98b 0 36%,transparent 36% 64%,#c98f3d 64% 100%)}
.hline .hempty{width:86px;height:8px;border-radius:4px;border:1px dashed rgba(138,127,149,.35);box-sizing:border-box}
.hline .mv{position:absolute;right:-16px;top:-2px;font-size:8px;color:#ffe9ad;font-style:normal;animation:formPulse 1.6s infinite}
.coins{font-family:sans-serif;font-size:12px;color:#c9b98f;display:flex;gap:10px;margin:0;min-height:20px;align-items:center}
.coin{width:16px;height:16px;border-radius:50%;background:linear-gradient(180deg,#f5d98b,#c98f3d);display:inline-block;box-shadow:0 0 10px rgba(245,217,139,.55);animation:coinFlip .3s linear infinite}
.coin.c2{animation-delay:.09s}.coin.c3{animation-delay:.17s}
@keyframes coinFlip{0%{transform:rotateX(0) translateY(0)}50%{transform:rotateX(180deg) translateY(-12px)}100%{transform:rotateX(360deg) translateY(0)}}
.qquote{font-size:16px;line-height:1.7;color:#f0e2b8;margin:0 0 2px;text-align:center;overflow-wrap:anywhere}
.coinstage{min-height:34px;display:flex;align-items:center;justify-content:center;gap:14px}
.coin.fly{animation:coinFly .75s ease-out both}
.coin.fly.c2{animation-delay:.09s}.coin.fly.c3{animation-delay:.17s}
@keyframes coinFly{0%{transform:translateY(26px) rotateX(0);opacity:0}18%{opacity:1}55%{transform:translateY(-24px) rotateX(540deg)}100%{transform:translateY(0) rotateX(1080deg);opacity:1}}
.hline.drop{animation:hexDrop .5s cubic-bezier(.2,.8,.3,1.25) both}
@keyframes hexDrop{from{opacity:0;transform:translateY(-16px) scaleX(.6);filter:brightness(2.6)}to{opacity:1;transform:none;filter:none}}
.wrapc{flex-wrap:wrap}
.bwrap{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:16px;filter:drop-shadow(0 0 18px rgba(245,217,139,.2))}
.persp{perspective:1100px;margin-top:22px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.persp.cardIn{animation:cardIn .95s cubic-bezier(.16,.9,.24,1) both;margin-top:calc(min(110vw,57vh,640px)*-0.33 - 120px);position:relative;z-index:2}
@keyframes cardIn{0%{opacity:0;transform:perspective(1100px) rotateX(58deg) translateY(-76px) scale(.55);filter:brightness(3) blur(14px)}45%{opacity:1;filter:brightness(1.7) blur(3px)}72%{transform:perspective(1100px) rotateX(-6deg) translateY(4px) scale(1.02);filter:brightness(1.1) blur(0)}100%{opacity:1;transform:none;filter:none}}
.gateflash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 30%,rgba(255,233,173,.55),rgba(255,233,173,.12) 34%,transparent 65%);animation:gf .9s ease-out forwards;z-index:5}
@keyframes gf{0%{opacity:0}35%{opacity:1}100%{opacity:0}}
.rvstage{min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;margin-top:6px}
.rvbig{display:flex;flex-direction:column;gap:10px;align-items:center;animation:rvIn .35s ease both,rvAbsorb 1.15s ease forwards}
.rvbig span{font-family:sans-serif;font-size:11.5px;letter-spacing:.3em;color:#9d8fb5}
.rvbig b{font-size:22px;color:#ffe9ad;font-weight:600;letter-spacing:.05em;text-shadow:0 0 26px rgba(245,217,139,.4)}
@keyframes rvAbsorb{0%,78%{opacity:1;transform:none;filter:none}100%{opacity:0;transform:translateY(-60px) scale(.72);filter:blur(5px)}}
.dimseq{display:flex;flex-direction:column;gap:10px;align-items:center;margin:4px 0;width:100%}
.dimq{font-size:15px;line-height:1.6;color:#f0e2b8;margin:0}
.dimrow{display:flex;gap:8px;width:100%}
.dimopt{flex:1;font-family:inherit;font-size:12.5px;padding:12px 8px;border-radius:14px;border:1px solid rgba(245,217,139,.24);background:rgba(245,217,139,.05);color:#c3b591;cursor:pointer;transition:all .25s;line-height:1.5;word-break:keep-all}.dimopt:hover{border-color:rgba(245,217,139,.5);color:#e6d9a8}
.dimopt.sel{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 14px rgba(245,217,139,.3),inset 0 0 10px rgba(245,217,139,.08)}
@keyframes rvIn{from{opacity:0;filter:blur(7px);transform:scale(.9)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes rvScatter{to{opacity:0;filter:blur(12px);letter-spacing:.7em;transform:scale(1.28)}}
.vhex{font-family:sans-serif;font-size:11px;color:#c9b98f;letter-spacing:.18em;margin:8px 0 0}
.season{font-family:sans-serif;font-size:10.5px;color:#8a7f95;margin-top:12px;letter-spacing:.04em;line-height:1.7}.season b{color:#ffe9ad}
.findlink{font-family:sans-serif;font-size:11.5px;color:#c9b98f;text-decoration:none;border-bottom:1px dotted #c9b98f66;margin-top:8px;display:inline-block}
.findlink:hover{color:#ffe9ad}
/* v109: grid \uD589\uC5D0 \uC0C1\uD55C\uC774 \uC5C6\uC73C\uBA74 \uB4B7\uBA74 \uBB38\uC11C \uAE38\uC774\uAC00 \uADF8\uB300\uB85C \uCE74\uB4DC \uB192\uC774\uAC00 \uB41C\uB2E4(\uC2E4\uCE21 1681px) \u2014
   \uC55E\uBA74 \uD310\uACB0 \uC544\uB798\uAC00 \uD145 \uBE44\uB294 \uD68C\uADC0. minmax(0,1fr)+max-height \uB85C \uD589\uC744 \uBB36\uACE0 \uC2A4\uD06C\uB864\uC740 .vscroll \uC774 \uB9E1\uB294\uB2E4 */
.vcard{position:relative;width:300px;min-height:430px;display:grid;grid-template-rows:minmax(0,1fr);transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.25,1)}
.vface{position:relative;grid-area:1/1;border-radius:16px;padding:24px;backface-visibility:hidden;background:linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);background-image:radial-gradient(1px 1px at 82% 12%,#ffe9ad26,transparent),radial-gradient(1px 1px at 14% 30%,#7fd4ff1f,transparent),radial-gradient(1.5px 1.5px at 70% 78%,#b48cff22,transparent),radial-gradient(1px 1px at 30% 88%,#ffe9ad1f,transparent),linear-gradient(165deg,#1a1428,#0f0b1a 42%,#191024);box-shadow:inset 0 0 0 1px rgba(245,217,139,.42),inset 0 0 0 7px rgba(15,11,26,1),inset 0 0 0 8px rgba(245,217,139,.16),0 26px 54px rgba(0,0,0,.68);display:flex;flex-direction:column;min-height:0;text-align:center;overflow:hidden}
.vcard::after{content:"";position:absolute;inset:-3px;border-radius:20px;background:conic-gradient(from 210deg,#c98f3d40,#7fd4ff26,#b48cff3a,#e04d2a26,#c98f3d40);z-index:-1;filter:blur(7px)}
.corner{position:absolute;font-size:9px;color:#c9b98f88;font-style:normal}
.corner.tl{top:12px;left:12px}.corner.tr{top:12px;right:12px}.corner.bl{bottom:12px;left:12px}.corner.br{bottom:12px;right:12px}
.vside{position:absolute;left:13px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-size:8.5px;letter-spacing:.6em;color:#c9b98f55;font-family:'Noto Serif KR',serif;pointer-events:none}
.vseal{position:absolute;right:16px;bottom:46px;width:28px;height:28px;background:linear-gradient(180deg,#c03434,#8e1f1f);color:#ffe9ad;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:4px;box-shadow:0 0 14px rgba(192,52,52,.45),inset 0 0 0 1px rgba(255,233,173,.3);font-family:'Noto Serif KR',serif;pointer-events:none;transition:opacity .5s}
.vseal.faded{opacity:.1}
/* v109: \uB4B7\uBA74\uC744 absolute \uB85C \uBE7C\uC11C \uCE74\uB4DC \uB192\uC774 \uC0B0\uC815\uC5D0\uC11C \uC81C\uC678\uD55C\uB2E4 \u2014 \uCE74\uB4DC \uD06C\uAE30\uB294 \uC55E\uBA74(\uD310\uACB0)\uC774 \uC815\uD558\uACE0,
   \uAE38\uC5B4\uC9C4 \uB9AC\uD3EC\uD2B8\uB294 .vscroll \uC548\uC5D0\uC11C \uC2A4\uD06C\uB864\uD55C\uB2E4. \uC774\uAC78 \uC548 \uD558\uBA74 \uBB38\uC11C \uAE38\uC774\uAC00 \uADF8\uB300\uB85C \uCE74\uB4DC \uB192\uC774\uAC00 \uB418\uC5B4
   \uC55E\uBA74 \uD310\uACB0\uBB38 \uC544\uB798\uAC00 \uD145 \uBE48\uB2E4(\uC2E4\uCE21 1681px). */
.vface.back{position:absolute;inset:0;transform:rotateY(180deg);text-align:left}
.vtop,.vbot{display:flex;justify-content:space-between;font-family:sans-serif;font-size:10px;letter-spacing:.2em;color:#c9b98f}
/* v109: \uB4B7\uBA74\uC774 \uD55C \uBB38\uC11C\uB85C \uC2A4\uD06C\uB864\uB418\uBA74\uC11C \uBCF8\uBB38\uC774 \uACE0\uC815 \uD5E4\uB354 \uC544\uB798\uB85C \uBE44\uCCD0 \uBCF4\uC600\uB2E4 \u2014 \uD5E4\uB354\uB97C \uBD88\uD22C\uBA85\uD558\uAC8C */
.vface.back .vtop{position:relative;z-index:2;background:#150f22;box-shadow:0 0 0 6px #150f22;margin-bottom:6px}
.vbot{margin-top:auto;color:#8a7f95}
.vq{font-size:14px;line-height:1.7;margin:22px 0 0;color:#d8cfe6;overflow-wrap:anywhere}
.vq.s{font-size:12.5px;line-height:1.6}
.vdiv{display:flex;align-items:center;gap:10px;color:#c98f3d;margin:14px 0;font-size:11px}.vdiv::before,.vdiv::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#c98f3d88,transparent)}
.vv{font-size:27px;font-weight:900;margin:0;background:linear-gradient(180deg,#ffe9ad,#c98f3d);-webkit-background-clip:text;background-clip:text;color:transparent;overflow-wrap:anywhere}
.vv.m{font-size:21px;line-height:1.55}.vv.s{font-size:17px;line-height:1.62}
.vv.go{background:linear-gradient(180deg,#b8ffd9,#3dc98f);-webkit-background-clip:text;background-clip:text}
.vv.hold{background:linear-gradient(180deg,#cfd8ff,#7f8fd4);-webkit-background-clip:text;background-clip:text}
.vs{color:#9d8fb5;font-size:13px;font-style:italic;margin:10px 0 0}
.vs.dim{opacity:.6}
.whybtn{margin:16px auto 0;display:block;background:transparent;border:1px solid #c98f3d66;color:#e6d6a8;font-size:12.5px;letter-spacing:.05em;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:sans-serif}
.whybtn:hover{border-color:#f5d98b;background:#f5d98b12}
.l2{margin-top:2px}
.vfun{font-family:sans-serif;font-size:11px;color:#c9b98f;margin:12px 0 0}
.vfun .dim{opacity:.55}
.pips{display:flex;align-items:center;gap:5px;justify-content:center;margin-top:16px;flex-wrap:wrap}
.pip{width:8px;height:8px;border-radius:50%;border:1px solid #c98f3d88}.pip.on{background:linear-gradient(180deg,#ffe9ad,#c98f3d);box-shadow:0 0 8px rgba(245,217,139,.6)}
.pips em{font-family:sans-serif;font-style:normal;font-size:11px;color:#c9b98f;margin-left:4px}
.vscroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}
.vr{list-style:none;padding:0 2px 8px 0;margin:14px 0 0;display:flex;flex-direction:column;gap:10px}
.vr li{border-left:2px solid #c98f3d;padding-left:10px}.vr li.fun{border-left-color:#6f6580;opacity:.7}
.vr b{color:#f0e2b8;font-size:12.5px}.vr em.vote{font-style:normal;font-family:sans-serif;font-size:9.5px;color:#c9b98f;margin-left:6px;letter-spacing:.08em}.vr p{margin:2px 0 0;color:#b5aac6;font-size:12px;line-height:1.55;font-family:sans-serif}
.msr{margin-top:6px;font-family:sans-serif}
.msrbtn{background:none;border:1px solid #c9b98f33;border-radius:8px;color:#c9b98f;font-size:11px;padding:5px 10px;width:100%;cursor:pointer}
/* v109 \uC54C \uAD8C\uB9AC: 170px \uC2A4\uD06C\uB864 \uC0C1\uC790\uB294 \uADF8 \uC790\uCCB4\uAC00 \uC740\uB2C9\uC774\uC5C8\uB2E4 \u2014 \uB9AC\uD3EC\uD2B8\uAC00 \uD55C \uBC88\uC5D0 6\uC904\uB9CC \uBCF4\uC600\uB2E4 */
.msrbody{margin-top:6px;padding:2px 2px 6px}
.msrp{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:6px 0 8px}
.msrpi{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 2px;border:1px solid #c9b98f22;border-radius:7px;background:#0f0b1a66}
.msrpi i{font-style:normal;font-size:9px;color:#9d8fb5;letter-spacing:.06em}
.msrpi b{font-size:14px;color:#e6dff2;letter-spacing:.02em}
.msrpi.me{border-color:#c9b98f77;background:#c9b98f12}.msrpi.me b{color:#f0d9a0}
.msrbody p{font-size:11px;color:#bfb6cc;line-height:1.55;margin:3px 0}
.msrbody b{color:#e6dff2;font-weight:700}
.msrsub{opacity:.72;font-size:12.5px}
.msrkey b{color:#f0d9a0}
.msrh{margin-top:7px !important;color:#c9b98f !important;letter-spacing:.14em;font-size:10px !important}
/* v110 \uC815\uC9C1\uC131 \u2014 \uD655\uC2E0\uB3C4 \uAF2C\uB9AC\uD45C. \uC138 \uAE09\uC774 \uD55C\uB208\uC5D0 \uAC08\uB824\uC57C \uD558\uBBC0\uB85C \uC0C9\uC73C\uB85C\uB3C4 \uAC00\uB978\uB2E4(\uACC4\uC0B0\uAC12=\uAE08 \xB7 \uD574\uC11D=\uC911\uAC04 \xB7 \uACC1\uAC00\uC9C0=\uD750\uB9BC) */
.cf{font-style:normal;font-size:8.5px;letter-spacing:.1em;border:1px solid;border-radius:4px;padding:1px 4px;margin:0 4px 0 0;white-space:nowrap;vertical-align:1px}
.cfh{color:#d9c48d;border-color:#c9b98f55}.cfm{color:#9d8fb5;border-color:#9d8fb544}.cfl{color:#6f6580;border-color:#6f658055}
.cfleg{font-size:9.5px !important;color:#6f6580 !important;line-height:1.9 !important;margin:2px 0 8px !important}
/* \uC2ED\uC131 3\uB2E8 \u2014 \uC26C\uC6B4 \uB9D0 \uC544\uB798\uC5D0 '\uC2E4\uC81C\uB85C\uB294'\uACFC '\uADF8\uB298'\uC744 \uB4E4\uC5EC\uC4F4\uB2E4. \uBC1D\uC740 \uBA74\uB9CC \uC4F0\uBA74 \uC544\uBB34\uC5D0\uAC8C\uB098 \uB9DE\uB294 \uB355\uB2F4\uC774 \uB41C\uB2E4 */
.msr3{display:block;margin-top:4px;padding-left:8px;border-left:1px solid #c9b98f26;color:#9d8fb5;font-size:10.5px;line-height:1.6}
.msr3 i{font-style:normal;color:#c9b98f;letter-spacing:.1em;margin-right:5px}
/* v111 \uD56D\uBAA9\uBCC4 4\uB2E8 \u2014 \uD55C \uC790\uB9AC\uAC00 \uD55C \uB369\uC5B4\uB9AC\uB85C \uC77D\uD600\uC57C \uD55C\uB2E4. 4\uB2E8 \uC0AC\uC774 \uC5EC\uBC31\uBCF4\uB2E4 \uC790\uB9AC \uC0AC\uC774 \uC5EC\uBC31\uC744 \uD06C\uAC8C \uC900\uB2E4 */
.dom{margin:10px 0 0;padding:9px 10px;border:1px solid #c9b98f1f;border-radius:9px;background:#0f0b1a4d}
.domh{margin:0 0 5px !important;color:#e6dff2 !important;font-size:12px !important;font-weight:700;letter-spacing:.01em}
.dstep{display:flex;gap:8px;margin:5px 0 !important;font-size:10.8px !important;line-height:1.62 !important}
.dstep i{flex:0 0 46px;font-style:normal;color:#c9b98f;font-size:9px;letter-spacing:.04em;text-align:right;padding-top:2.5px;white-space:nowrap}
.dstep .dt{flex:1 1 auto;min-width:0}   /* \uBCF8\uBB38\uC740 \uC5F4 \uD558\uB098\uB85C \uBB36\uB294\uB2E4 \u2014 \uC548 \uADF8\uB7EC\uBA74 \uAC15\uC870 \uC870\uAC01\uB9C8\uB2E4 \uC5F4\uC774 \uAC08\uB9B0\uB2E4 */
.dstep b{color:#f0d9a0}

/* \u2500\u2500 v113 \uAC01\uC778 \u2014 \uD310\uACB0 \uCE74\uB4DC\uC640 \uB2E4\uB978 \uACB0\uC774\uC5B4\uC57C \uD55C\uB2E4. \uCE74\uB4DC\uB294 \uC9E7\uACE0 \uAC01\uC778\uC740 \uBB38\uC11C\uB2E4 \u2500\u2500 */
/* v115 \uAC01\uC778 \u2014 4\uB2E8\xB7\uADF8\uB798\uD504\xB7\uCD94\uAC00 \uC785\uB825 */
.impask{margin:14px 0 6px;padding:14px 14px;border:1px solid #c98f3d44;border-radius:9px;background:#c98f3d0f}
.impaskh{font-size:12.5px;color:#f0e2b8;margin:0}
.impaskh i{font-style:normal;float:right;font-size:9.5px;color:#8a7f95;letter-spacing:.1em}
.impaskrow{display:flex;align-items:center;gap:7px;margin-top:11px}
.impaskrow span{font-size:11.5px;color:#9d8fb5;flex:0 0 72px}
.impchip{background:none;border:1px solid #c9b98f3d;border-radius:14px;color:#bfb6cc;font-size:11.5px;padding:4px 13px;cursor:pointer}
.impchip.on{border-color:#f5d98b;color:#f5d98b;background:#c98f3d1f}
@keyframes impRise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
@keyframes impDraw{from{stroke-dashoffset:1400}to{stroke-dashoffset:0}}
@keyframes impFill{from{opacity:0}to{opacity:1}}
.imp .impdom,.imp .impsky,.imp .impclash,.imp .impband,.imp .impck{animation:impRise .5s cubic-bezier(.22,.8,.28,1) both}
.imp .impsvg{animation:impRise .55s cubic-bezier(.22,.8,.28,1) both}
.drawin .mline{stroke-dasharray:1400;animation:impDraw 1.5s cubic-bezier(.3,.7,.3,1) .15s both}
.drawin .jline{animation:impFill .6s ease both}
.drawin .jline:nth-of-type(1){animation-delay:.1s}.drawin .jline:nth-of-type(2){animation-delay:.22s}
.drawin .jline:nth-of-type(3){animation-delay:.34s}.drawin .jline:nth-of-type(4){animation-delay:.46s}
.drawin .jline:nth-of-type(5){animation-delay:.58s}.drawin .jline:nth-of-type(6){animation-delay:.7s}
.drawin .jline:nth-of-type(7){animation-delay:.82s}
.drawin .mfill{animation:impFill 1s ease .9s both}
.drawin line,.drawin circle,.drawin text{animation:impFill .7s ease .5s both}
@media (prefers-reduced-motion:reduce){.imp .impdom,.imp .impsky,.imp .impclash,.imp .impband,.imp .impck,.imp .impsvg,.drawin .mline,.drawin .jline,.drawin .mfill,.drawin line,.drawin circle,.drawin text{animation:none}}
@keyframes impPulse{0%,100%{opacity:.14;r:9}50%{opacity:.3;r:13}}
.drawin .pulse{animation:impPulse 2.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.drawin .pulse{animation:none}}
.impsaga{font-size:14px;line-height:1.95;color:#d8cfe8;margin:0 0 12px;letter-spacing:-.01em}
.impsaga b{color:#f0e2b8}
.impch{margin:0 0 2px;padding:11px 12px;border-left:2px solid #6f658044}
.impch.past{opacity:.62}
.impch.on{border-left-color:#f5d98b;background:linear-gradient(90deg,#c98f3d14,transparent)}
.impchh{margin:0;font-size:13px;color:#e6dff2;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.impchh i{font-style:normal;font-size:9.5px;color:#c98f3daa;letter-spacing:.14em}
.impchh em{font-style:normal;margin-left:auto;font-size:10px;color:#8a7f95;font-variant-numeric:tabular-nums}
.impchh .here{font-size:9px;color:#0f0b18;background:#f5d98b;border-radius:8px;padding:1px 7px;letter-spacing:.08em}
.impchw{margin:6px 0 0;font-size:12.5px;line-height:1.8;color:#b3a8c6}
.impchd{color:#6f6580;font-size:11px}
.impmark{margin:7px 0 0;font-size:12px;line-height:1.8;color:#c8bcd8;padding-left:9px;border-left:1px solid #e8a06a44}
.impmark i{font-style:normal;display:inline-block;font-size:9px;color:#e8a06a;letter-spacing:.1em;margin-right:6px}
.impmark b{color:#f0d0a8}
.impepi{margin:14px 0 4px;padding:13px 14px;border-radius:9px;border:1px solid #c98f3d55;background:#c98f3d10;font-size:13.5px;line-height:1.95;color:#d8cfe8}
.impepi b{color:#f0e2b8}
.imph2{font-size:12px;color:#c9b98f;letter-spacing:.06em;margin:16px 0 6px}
.imph2 i{font-style:normal;font-size:9.5px;color:#6f6580;margin-left:8px;letter-spacing:.1em}
.impyrs{margin:0 0 4px}
.impyr{display:flex;gap:10px;align-items:baseline;padding:6px 2px;border-bottom:1px solid #6f658022;font-size:12px}
.impyr b{flex:0 0 44px;color:#8a7f95;font-weight:500;font-variant-numeric:tabular-nums}
.impyr span{color:#c8bcd8}
.impyr.up b,.impyr.up span{color:#9dc0ee}
.impyr.dn b,.impyr.dn span{color:#e0a094}
.impwest{margin:9px 0 0;padding:8px 10px;border-left:2px solid #5b8fd455;background:#5b8fd40d;border-radius:0 6px 6px 0;font-size:11.5px;line-height:1.75;color:#9dc0ee}
.impwest b{color:#c5dcf7}
.impcap{font-size:11px;line-height:1.75;color:#8a7f95;margin:2px 0 8px}
.impcap b{color:#c9b98f}
.impmrows{margin:0 0 4px}
.impmrow{display:flex;gap:10px;align-items:baseline;padding:6px 2px;border-bottom:1px solid #6f658022;font-size:12px}
.impmrow b{flex:0 0 58px;color:#8a7f95;font-weight:500;font-variant-numeric:tabular-nums}
.impmrow span{color:#c8bcd8}
.impmrow.on b,.impmrow.on span{color:#f0e2b8}
.impsky{margin:0 0 4px;padding:11px 12px;border-left:2px solid #6f658055;background:#1a152455;border-radius:0 7px 7px 0}
.impskh{font-size:11px;color:#8a7f95;margin:0;letter-spacing:.02em}
.impskh i{font-style:normal;display:block;font-size:9.5px;color:#c98f3daa;letter-spacing:.12em;margin-bottom:3px}
.impskv{font-size:12px;color:#f0e2b8;margin:5px 0 6px;font-weight:600}
.impskw{font-size:13px;line-height:1.85;color:#c8bcd8;margin:0}
.impskw b{color:#e6dff2}
.impclash{margin:0 0 8px;padding:12px 13px;border:1px solid #c98f3d44;border-radius:9px;background:#c98f3d0d}
.impclash>b{font-size:12px;color:#f0e2b8;letter-spacing:.04em}
.impclash p{font-size:13px;line-height:1.85;color:#c8bcd8;margin:6px 0 0}
.impclash p b{color:#e8a06a}
.impband .dbl{font-size:9.5px;color:#e8a06a;font-style:normal;margin-left:6px}
.impband .only{font-size:10.5px;color:#8a7f95;margin-top:4px}
.impwv{margin:12px 0 10px;padding:13px 14px;border-radius:9px;border:1px solid #6f658055;background:#1a152488}
.impwv.agree{border-color:#c98f3d66;background:#c98f3d10}
.impwh{font-size:14px;line-height:1.75;color:#e6dff2;margin:0}
.impwh b{color:#f0e2b8}
.impwt{font-size:12.5px;line-height:1.8;color:#b3a8c6;margin:9px 0 0}
.impws{font-size:12px;line-height:1.8;color:#e8a06a;margin:9px 0 0;padding-top:9px;border-top:1px solid #6f658044}
.impwrows{margin:2px 0 4px}
.impwrow{display:grid;grid-template-columns:1fr 88px;gap:2px 8px;padding:8px 2px;border-bottom:1px solid #6f658022}
.impwrow.on .impwsay{color:#f0e2b8}
.impwfrom{font-size:10.5px;color:#8a7f95;letter-spacing:.02em}
.impwval{grid-row:1/3;align-self:center;font-size:11.5px;color:#9d8fb5;text-align:right}
.impwsay{font-size:12.5px;color:#c8bcd8}
.impnum{width:74px;background:#1a1524;border:1px solid #6f658055;border-radius:7px;color:#e6dff2;font-size:12px;padding:5px 8px;font-family:inherit}
.impnum:focus{outline:none;border-color:#c98f3d99}
.impaskhint{font-style:normal;font-size:9.5px;color:#6f6580}
.impaskw{font-size:10.5px;line-height:1.7;color:#8a7f95;margin:11px 0 9px}
.impaskw b{color:#c9b98f}
.impsvg{display:block;margin:12px 0 2px;background:#0f0b1a4d;border-radius:8px;padding:6px 0}
.impdom{margin-top:14px;padding:12px 12px 6px;border:1px solid #c9b98f1f;border-radius:9px;background:#0f0b1a40}
.impdh{margin:0 0 6px !important;font-size:13.5px !important;color:#f0e2b8 !important;font-weight:700}
.impstep{display:flex;gap:9px;padding:7px 0;border-top:1px solid #c9b98f14}
.impstep:first-of-type{border-top:none}
.impstep i{flex:0 0 48px;font-style:normal;font-size:9px;color:#c9b98f;letter-spacing:.04em;text-align:right;padding-top:3px;white-space:nowrap}
.impstep span{flex:1 1 auto;min-width:0;font-size:12px;line-height:1.8;color:#bfb6cc}
.impstep b{color:#f0e2b8;font-weight:700}
.impck{display:grid;grid-template-columns:20px 1fr;gap:0 10px;padding:9px 2px;border-bottom:1px solid #c9b98f14;align-items:start}
.impck i{width:16px;height:16px;border:1.4px solid #c98f3d;border-radius:3px;margin-top:2px;display:block}
.impck b{font-size:12.5px;color:#e6dff2;font-weight:700;line-height:1.6}
.impck p{font-size:10.5px;color:#8a7f95;line-height:1.6;margin:4px 0 0}
.impbadge{font-size:9px;letter-spacing:.14em;border:1px solid #c9b98f55;border-radius:3px;padding:1px 5px;margin-left:6px;color:#c9b98f;vertical-align:1px}
.imp{font-family:sans-serif;padding:6px 2px 30px}
.imphead{padding:6px 0 20px;border-bottom:1px solid #c9b98f2e;margin-bottom:8px}
.impeyebrow{font-size:10px;letter-spacing:.4em;color:#c9b98f;margin:0}
.imptitle{font-size:25px;color:#f0e2b8;margin:12px 0 0;line-height:1.4;letter-spacing:-.01em}
.impsub{font-size:12px;color:#9d8fb5;line-height:1.7;margin:10px 0 0}
.impsub b{color:#e6dff2}
.imph{margin:26px 0 10px !important;color:#c9b98f !important;letter-spacing:.16em;font-size:10.5px !important;border-top:1px solid #c9b98f22;padding-top:14px}
.imph i{font-style:normal;float:right;letter-spacing:.04em;color:#6f6580;font-size:9.5px}
.impdcl{font-size:19px;line-height:1.62;color:#f0e2b8;margin:4px 0 0}
.impdcl b{color:#f5d98b}
.impdcl2{font-size:17px;line-height:1.6;color:#f0e2b8;margin:4px 0 0}
.impdcl2 b{color:#f5d98b}
.impp{font-size:12.5px;line-height:1.85;color:#bfb6cc;margin:10px 0 0}
.impp b{color:#e6dff2;font-weight:700}
.impcore{margin:16px 0 0;padding:16px 16px;background:#0f0b1a99;border-left:2px solid #c98f3d}
.impk2{font-size:9.5px;letter-spacing:.34em;color:#c9b98f;margin:0}
.impcv{font-size:17px;line-height:1.55;color:#f4ead2;margin:10px 0 0}
.impcv b{color:#f5d98b}
.impcw{font-size:12px;line-height:1.8;color:#9d8fb5;margin:10px 0 0}
.impfix{font-size:12.5px;line-height:1.8;color:#e6dff2;margin:12px 0 0;padding:11px 13px;background:#c98f3d14;border-radius:7px}
.impr{display:grid;grid-template-columns:76px 1fr;gap:0 12px;padding:11px 2px;border-bottom:1px solid #c9b98f1a;align-items:start}
.impk{font-size:10.5px;color:#8a7f95;letter-spacing:.04em;padding-top:2px}
.impv{font-size:12.5px;line-height:1.8;color:#bfb6cc}
.impv b{color:#f0e2b8;font-weight:700}
.impv em{font-style:normal;display:block;color:#8a7f95;font-size:11.5px;line-height:1.75;margin-top:5px}
.imptrig{margin-top:12px;padding:12px 13px;border:1px solid #c9b98f1f;border-radius:8px;background:#0f0b1a4d}
.imptrig b{font-size:13.5px;color:#f0e2b8}
.imptrig p{font-size:12px;line-height:1.8;color:#a99fb8;margin:7px 0 0}
.impwhen{margin-top:14px;padding:12px 13px;background:#a8322914;border-left:2px solid #a83229;font-size:12px;line-height:1.8;color:#bfb6cc}
.impwhen b{color:#f0e2b8}
.impband{display:grid;grid-template-columns:78px 1fr;gap:0 12px;padding:12px 2px;border-bottom:1px solid #c9b98f1a}
.impband.now{background:#c98f3d12;margin:0 -8px;padding-left:10px;padding-right:8px}
.impage{font-size:13px;color:#c9b98f;letter-spacing:.02em}
.impage i{display:block;font-style:normal;font-size:9px;color:#6f6580;margin-top:3px;letter-spacing:.14em}
.impband b{font-size:13.5px;color:#f0e2b8}
.impband em{font-style:normal;font-size:10px;color:#f5d98b;margin-left:6px}
.impband p{font-size:11.5px;line-height:1.75;color:#9d8fb5;margin:6px 0 0}
.impmsg{font-size:11.5px;line-height:1.8;color:#8a7f95;margin:14px 0 0;padding:10px 12px;border:1px dashed #c9b98f33;border-radius:7px}
.impmsg b{color:#c9b98f}
.impfoot{margin-top:30px;padding-top:16px;border-top:1px solid #c9b98f22}
sup.impfx{font-size:9px;color:#c98f3d;vertical-align:super;margin-left:2px}
.impnotes{list-style:none;padding:0;margin:12px 0 0}
.impnotes li{display:grid;grid-template-columns:22px 1fr;gap:0 8px;font-size:10.5px;line-height:1.7;color:#8a7f95;padding:7px 0;border-bottom:1px solid #c9b98f14}
.impnotes li span:first-child{color:#c98f3d}
.impnotes li b{color:#bfb6cc}
.disc{margin-top:auto;font-family:sans-serif;font-size:10px;color:#8a7f95;line-height:1.5}
.split{font-family:sans-serif;font-size:10.5px;letter-spacing:.22em;color:#e5b96b;margin:0 0 6px;animation:formPulse 1.8s ease-in-out infinite}
.retrybtn{background:transparent;border:1px solid #c98f3d66;color:#e6d6a8;font-size:11px;padding:3px 12px;border-radius:14px;cursor:pointer;font-family:sans-serif;margin-left:8px}
.retrybtn:hover{border-color:#f5d98b}
.resetlink{background:none;border:none;margin-top:18px;color:#5f5670;font-family:sans-serif;font-size:10.5px;letter-spacing:.06em;cursor:pointer;text-decoration:underline dotted}
.resetlink:hover{color:#9d8fb5}
.daily{width:100%;border:1px solid rgba(245,217,139,.28);border-radius:14px;padding:14px 16px;margin:2px 0 14px;background:linear-gradient(160deg,#1c173066,#120e1e88)}
.dtag{font-family:sans-serif;font-size:9.5px;letter-spacing:.22em;color:#c9b98f;margin:0 0 8px}
.dmain{font-size:14.5px;line-height:1.8;color:#e8dff5;margin:0}.dmain b{color:#ffe9ad;font-weight:600}
.dverdict{font-size:13.5px;line-height:1.75;color:#e5b96b;margin:6px 0 10px;overflow-wrap:anywhere}
.dsub{font-family:sans-serif;font-size:10.5px;color:#8a7f95;line-height:1.7;margin:8px 0 10px}
.btn.sm{padding:8px 18px;font-size:12px;letter-spacing:.08em}
.knock{background:none;border:1px dashed rgba(245,217,139,.35);border-radius:999px;padding:10px 22px;margin:2px 0 14px;color:#c9b98f;font-family:inherit;font-size:13px;letter-spacing:.04em;cursor:pointer;transition:all .3s}
.knock:hover{border-color:#ffe9ad;color:#ffe9ad;box-shadow:0 0 16px rgba(245,217,139,.15)}
.streak{font-family:sans-serif;font-size:10.5px;letter-spacing:.18em;color:#c9b98f;margin:0 0 10px}
.vlog{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:12px;text-align:left}
.vlogrow{display:flex;gap:10px;align-items:center;border:1px solid rgba(138,127,149,.22);border-radius:12px;padding:8px 10px;background:#120e1e66}
.vlogtxt{flex:1;min-width:0}
.vlogq{margin:0;font-size:12.5px;color:#cbc0dd;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vlogmeta{margin:3px 0 0;font-family:sans-serif;font-size:10px;color:#8a7f95}
.vlogmeta b{font-weight:600}.lgo{color:#3dc98f}.lstop{color:#e05a5a}.lhold{color:#7f8fd4}
.vlogrow{cursor:pointer;transition:border-color .2s}.vlogrow:hover{border-color:rgba(201,143,61,.4)}.vlogrow.open .vlogq{white-space:normal;overflow:visible}.vlogverdict{margin:5px 0 0;font-size:13px;color:#e7dcf5;line-height:1.55;border-top:1px solid rgba(255,255,255,.09);padding-top:5px}
@media(max-width:520px){.stage{padding:20px 10px 72px}.scene{max-width:100%}.gpanel{width:95vw;padding:0}.grid16{gap:6px}}
@media(prefers-reduced-motion:reduce){.fade,.line,.spark,.mcard,.chip.on,.halo.busy,.forming,.persp.cardIn,.hline .mv,.rv,.gateflash{animation:none;transition:none;opacity:1;transform:none}}
`;
export {
  calcSaju,
  cityLon,
  daeun,
  App as default,
  equationOfTime,
  lunar2solar,
  moonLongitude,
  moonPlacements,
  solar2lunar,
  sunLongitude,
  tzolkin
};
