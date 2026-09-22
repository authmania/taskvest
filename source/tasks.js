/*
 * TaskVest — Tasks Engine
 * ----------------------------------------------------------------
 * Ported from TaskVest-asstCeo. Adds:
 *   • Activation gate           (TaskVest_account_active)
 *   • Call simulator engine     (3 contacts, audio, ₦6,100/call, 3/day)
 *   • Favorites sponsor loop    (12 brands, ₦1,028/save, 4/day)
 *   • Withdrawal threshold      (₦250,000 gate)
 *   • eSIM plan chooser         (Diamond ₦10,500 / Royal ₦17,500)
 *
 * All state lives in localStorage. Loads after auth.js.
 */
(function () {
    'use strict';

    /* ====================================================================
     * CONSTANTS  (verbatim from TaskVest-asstCeo)
     * ==================================================================== */
    var CONST = {
        SIGNUP_BONUS:        200000,
        CALL_DISPLAY_MAX:    2100,
        CALL_CREDIT:         2100,
        CALL_DURATION:       8000,
        CALL_STEP:           50,
        CALL_RING_DELAY:     3000,
        CALL_DAILY_LIMIT:    2,
        HISTORY_CAP:         10,
        FAV_LIMIT:           4,
        FAV_REWARD:          1028,
        FAV_RESET_WINDOW:    86400000,
        WITHDRAW_THRESHOLD:  250000,
        WITHDRAW_AMOUNT:     250000,
        DIAMOND_PRICE:       0,
        ROYAL_PRICE:         14000,
        STORAGE_SLOTS:       10,
        MAX_UNACTIVATED_EARNINGS: 250000,
        DAILY_EARN_CAP_ENABLED: true,
        DAILY_EARN_CAP_AMOUNT: 100000,
        TASK_REWARD: 10000,
        TASK_DAILY_LIMIT: 10,
    };

    var SPONSORS = [
        { name: 'Linda',   brand: 'NaijaCard',        rate: 628 },
        { name: 'James',   brand: 'Ajo',              rate: 628 },
        { name: 'Sarah',   brand: 'Prospa',           rate: 628 },
        { name: 'David',   brand: 'Pay4Me',           rate: 628 },
        { name: 'Amanda',  brand: 'MAX',              rate: 628 },
        { name: 'Michael', brand: 'Terra Industries', rate: 628 },
        { name: 'Grace',   brand: 'Cybervergent',     rate: 628 },
        { name: 'Daniel',  brand: 'Remedial Health',  rate: 628 },
        { name: 'Sophia',  brand: '10mg Health',      rate: 628 },
        { name: 'Victor',  brand: 'Tuteria',          rate: 628 }
    ];

    var PHONEBOOK = [
        { id: 'naijacard-linda', name: 'Linda', brand: 'NaijaCard', phone: '0700-NCARD-01', rate: 628, audio: ['https://files.catbox.moe/ygstdo.mp3'] },
        { id: 'ajo-james', name: 'James', brand: 'Ajo', phone: '0700-AJO-02', rate: 628, audio: ['https://files.catbox.moe/sabdrd.mp3'] },
        { id: 'prospa-sarah', name: 'Sarah', brand: 'Prospa', phone: '0700-PRSP-03', rate: 628, audio: ['https://files.catbox.moe/gd14mz.mp3'] },
        { id: 'pay4me-david', name: 'David', brand: 'Pay4Me', phone: '0700-P4ME-04', rate: 628, audio: ['https://files.catbox.moe/23udtr.mp3'] },
        { id: 'max-amanda', name: 'Amanda', brand: 'MAX', phone: '0700-MAX-05', rate: 628, audio: ['https://files.catbox.moe/2r8d9c.mp3'] },
        { id: 'terra-michael', name: 'Michael', brand: 'Terra Industries', phone: '0700-TRRA-06', rate: 628, audio: ['https://files.catbox.moe/6tl8g8.mp3'] },
        { id: 'cybervergent-grace', name: 'Grace', brand: 'Cybervergent', phone: '0700-CYBR-07', rate: 628, audio: ['https://files.catbox.moe/jhqt04.mp3'] },
        { id: 'remedial-daniel', name: 'Daniel', brand: 'Remedial Health', phone: '0700-RMED-08', rate: 628, audio: ['https://files.catbox.moe/fyoh38.mp3'] },
        { id: '10mg-sophia', name: 'Sophia', brand: '10mg Health', phone: '0700-10MG-09', rate: 628, audio: ['https://files.catbox.moe/odr82j.mp3'] },
        { id: 'tuteria-victor', name: 'Victor', brand: 'Tuteria', phone: '0700-TUTR-10', rate: 628, audio: ['https://files.catbox.moe/9yrq7p.mp3'] }
    ];

    var SPONSOR_AUDIO = {
        Linda: ['https://files.catbox.moe/ygstdo.mp3'],
        James: ['https://files.catbox.moe/sabdrd.mp3'],
        Sarah: ['https://files.catbox.moe/gd14mz.mp3'],
        David: ['https://files.catbox.moe/23udtr.mp3'],
        Amanda: ['https://files.catbox.moe/2r8d9c.mp3'],
        Michael: ['https://files.catbox.moe/6tl8g8.mp3'],
        Grace: ['https://files.catbox.moe/jhqt04.mp3'],
        Daniel: ['https://files.catbox.moe/fyoh38.mp3'],
        Sophia: ['https://files.catbox.moe/odr82j.mp3'],
        Victor: ['https://files.catbox.moe/9yrq7p.mp3'],
        NaijaCard: ['https://files.catbox.moe/ygstdo.mp3'],
        Ajo: ['https://files.catbox.moe/sabdrd.mp3'],
        Prospa: ['https://files.catbox.moe/gd14mz.mp3'],
        Pay4Me: ['https://files.catbox.moe/23udtr.mp3'],
        MAX: ['https://files.catbox.moe/2r8d9c.mp3'],
        'Terra Industries': ['https://files.catbox.moe/6tl8g8.mp3'],
        Cybervergent: ['https://files.catbox.moe/jhqt04.mp3'],
        'Remedial Health': ['https://files.catbox.moe/fyoh38.mp3'],
        '10mg Health': ['https://files.catbox.moe/odr82j.mp3'],
        Tuteria: ['https://files.catbox.moe/9yrq7p.mp3']
    };

    var ACTIVATION_CODES = [
        'NXT-951756178','NXT-284715903','NXT-638491275','NXT-715204986',
        'NXT-460918372','NXT-127594683','NXT-852716490','NXT-349185627',
        'NXT-906417258','NXT-571263849','NXT-248719635','NXT-615438927',
        'NXT-794521863','NXT-183674952','NXT-427915386','NXT-568243719',
        'NXT-739615824','NXT-294861537','NXT-845297163','NXT-316754928',
        'NXT-924681375','NXT-517293846','NXT-682154739','NXT-145879326',
        'NXT-358926471','NXT-471638295','NXT-863275914','NXT-296418753',
        'NXT-734829561','NXT-581746392','NXT-972413685','NXT-264785913',
        'NXT-613927548','NXT-748561239','NXT-459873126','NXT-136594872',
        'NXT-827461953','NXT-594238617','NXT-315876429','NXT-781452963',
        'NXT-254963871','NXT-698741352','NXT-843216795','NXT-572894136',
        'NXT-917364528','NXT-384527691','NXT-625198473','NXT-148736952',
        'NXT-753281649','NXT-486952731'
    ];

    /* ====================================================================
     * STORAGE KEYS  (prefix with nx_ to match auth.js conventions)
     * ==================================================================== */
    var K = {
        ACTIVE:    'nx_account_active',     // "true"/"false"
        EARNINGS:  'nx_total_earnings',     // number, default 10000
        CALL_DATA: 'nx_call_data',          // {date, counts, history}
        FAVORITES: 'nx_favorites',          // [{name,brand,rate}]
        FAV_LIMIT: 'nx_favorite_limit',     // {count, reset}
        SAVED:     'nx_saved_contacts',     // int
        CODES:     'nx_activation_codes',   // [string]
        WITHDRAW:  'nx_withdrawals',        // [{amount, status, date, time}]
        PLAN:      'nx_esim_plan'           // "premium" | "elite"
    };

    var USER_SCOPED = ['nx_account_active','nx_total_earnings','nx_created_at','nx_withdrawals','nx_call_data','nx_favorites','nx_favorite_limit','nx_saved_contacts','nx_esim_plan','nx_transactions','nx_daily_earned'];
    function uk(base) {
        var u = '';
        try { var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {}; u = s.id || s.userId || s.email || ''; } catch (_) {}
        if (!u && typeof window.nxUserKey === 'function') return window.nxUserKey(base);
        return u ? (base + '_' + u) : base;
    }
    function scopedKey(key) { return USER_SCOPED.indexOf(key) !== -1 ? uk(key) : key; }
    function get(key, fb) {
        try { var v = localStorage.getItem(scopedKey(key)); return v == null ? fb : JSON.parse(v); }
        catch (_) { return fb; }
    }
    function set(key, val) { localStorage.setItem(scopedKey(key), JSON.stringify(val)); }

    function normalizeExternalUrl(raw) {
        if (!raw || typeof raw !== 'string') return '';
        var trimmed = raw.trim();
        if (!trimmed || trimmed === '#' || trimmed === 'about:blank') return '';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return 'https://' + trimmed;
    }

    /* ====================================================================
     * STATE
     * ==================================================================== */
    function isActive() {
        var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (s.accountActive === true || s.account_active === true) {
            localStorage.setItem(uk(K.ACTIVE), 'true');
            return true;
        }
        if (s.accountActive === false || s.account_active === false) {
            localStorage.setItem(uk(K.ACTIVE), 'false');
            return false;
        }
        if (localStorage.getItem(uk(K.ACTIVE)) === 'true' || localStorage.getItem(uk('nx_account_active')) === 'true') return true;
        if (s.isActivated || s.is_activated || s.activated || s.plan) {
            localStorage.setItem(uk(K.ACTIVE), 'true');
            return true;
        }
        return false;
    }
    function setActive(v) {
        localStorage.setItem(uk(K.ACTIVE), v ? 'true' : 'false');
        localStorage.setItem(uk('nx_account_active'), v ? 'true' : 'false');
        var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        s.accountActive = !!v;
        s.account_active = !!v;
        if (window.NexAuth && NexAuth.store && NexAuth.store.login) NexAuth.store.login(s);
    }
    function earnings() {
        var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (s.balance != null && !isNaN(s.balance)) {
            var sVal = Number(s.balance);
            localStorage.setItem(uk(K.EARNINGS), String(sVal));
            localStorage.setItem(uk('nx_total_earnings'), String(sVal));
            return sVal;
        }
        var stored = Number(localStorage.getItem(uk(K.EARNINGS)));
        if (!isNaN(stored)) return stored;
        return CONST.SIGNUP_BONUS;
    }
    function setEarnings(n) {
        var val = Number(n) || 0;
        localStorage.setItem(uk(K.EARNINGS), String(val));
        localStorage.setItem(uk('nx_total_earnings'), String(val));
        var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (s) {
            s.balance = val;
            if (s.lifetimeEarnings == null || s.lifetimeEarnings < val) s.lifetimeEarnings = val;
            if (s.lifetime_earnings == null || s.lifetime_earnings < val) s.lifetime_earnings = val;
            if (window.NexAuth && NexAuth.store && NexAuth.store.login) NexAuth.store.login(s);
        }
    }
    function addEarnings(n, label, wallet) {
        if (isThresholdReached()) {
            showThresholdModal();
            return earnings();
        }
        if (isDailyEarnCapEnabled() && isDailyCapReachedSync()) {
            showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
            return earnings();
        }
        var amt = Number(n) || 0;
        var currentBal = earnings();
        if (!isActive() && (currentBal + amt) >= CONST.MAX_UNACTIVATED_EARNINGS) {
            var newTotal = CONST.MAX_UNACTIVATED_EARNINGS;
            var addedDelta = Math.max(0, CONST.MAX_UNACTIVATED_EARNINGS - currentBal);
            setEarnings(newTotal);
            cachedTodayEarned += addedDelta;
            lastTodayEarnedCheck = Date.now();

            var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
            var life = Math.max(Number(session.lifetimeEarnings || session.lifetime_earnings || 0), newTotal);
            session.balance = newTotal;
            session.lifetimeEarnings = life;
            session.lifetime_earnings = life;
            if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
                NexAuth.store.login(session);
            }

            if (window.NexAuth && NexAuth.store && typeof NexAuth.store.addTx === 'function') {
                NexAuth.store.addTx({
                    label: label || 'Task reward',
                    amount: addedDelta,
                    wallet: wallet || 'total',
                    type: 'earn'
                });
            }

            if (window.TaskVestSupabase && session.id) {
                try {
                    TaskVestSupabase.syncProfile(session.id, {
                        balance: newTotal,
                        lifetime_earnings: life
                    });
                    TaskVestSupabase.syncTransaction(session.id, {
                        type: 'earn',
                        label: label || 'Task reward',
                        amount: addedDelta,
                        wallet: wallet || 'total',
                        status: 'completed'
                    });
                } catch (_) {}
            }

            if (session.id || session.email) {
                fetch('/api/user/sync-balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: session.id,
                        email: session.email,
                        balance: newTotal,
                        delta: addedDelta,
                        label: label || 'Task reward',
                        wallet: wallet || 'total'
                    })
                }).catch(function () {});
            }

            refreshAll();
            showThresholdModal();
            return newTotal;
        }

        var newTotal = currentBal + amt;
        setEarnings(newTotal);
        cachedTodayEarned += amt;
        lastTodayEarnedCheck = Date.now();

        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        var life = Math.max(Number(session.lifetimeEarnings || session.lifetime_earnings || 0), newTotal);
        session.balance = newTotal;
        session.lifetimeEarnings = life;
        session.lifetime_earnings = life;
        if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
            NexAuth.store.login(session);
        }

        // Push a single transaction to the client store
        if (window.NexAuth && NexAuth.store && typeof NexAuth.store.addTx === 'function') {
            NexAuth.store.addTx({
                label: label || 'Task reward',
                amount: amt,
                wallet: wallet || 'total',
                type: 'earn'
            });
        }

        var directSynced = false;
        // Sync to Supabase directly
        if (window.TaskVestSupabase && session.id) {
            try {
                TaskVestSupabase.syncProfile(session.id, {
                    balance: newTotal,
                    lifetime_earnings: life
                });
                TaskVestSupabase.syncTransaction(session.id, {
                    type: 'earn',
                    label: label || 'Task reward',
                    amount: amt,
                    wallet: wallet || 'total',
                    status: 'completed'
                });
                directSynced = true;
            } catch (_) {}
        }

        // Hit server fallback endpoint (only pass delta if client direct sync was not executed)
        if (session.id || session.email) {
            fetch('/api/user/sync-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.id,
                    email: session.email,
                    balance: newTotal,
                    delta: directSynced ? 0 : amt,
                    label: label || 'Task reward',
                    wallet: wallet || 'total'
                })
            }).catch(function () {});
        }

        // Refresh the visible balance + wallet rows immediately on claim
        if (window.NexAuth && typeof NexAuth.renderBalances === 'function') NexAuth.renderBalances();
        refreshAll();
        return newTotal;
    }

    var cachedTodayEarned = 0;
    var lastTodayEarnedCheck = 0;

    function isDailyEarnCapEnabled() {
        if (typeof NEXTEL_CONFIG !== 'undefined' && NEXTEL_CONFIG) {
            if (NEXTEL_CONFIG.dailyEarnCapEnabled !== undefined) return !!NEXTEL_CONFIG.dailyEarnCapEnabled;
            if (NEXTEL_CONFIG.daily_earn_cap_enabled !== undefined) return !!NEXTEL_CONFIG.daily_earn_cap_enabled;
        }
        return !!CONST.DAILY_EARN_CAP_ENABLED;
    }

    function getDailyEarnCapAmount() {
        if (typeof NEXTEL_CONFIG !== 'undefined' && NEXTEL_CONFIG) {
            var val = Number(NEXTEL_CONFIG.dailyEarnCapAmount != null ? NEXTEL_CONFIG.dailyEarnCapAmount : NEXTEL_CONFIG.daily_earn_cap_amount);
            if (!isNaN(val) && val > 0) return val;
        }
        return CONST.DAILY_EARN_CAP_AMOUNT || 15000;
    }

    async function resolveTodayEarnedFromUserTasks(forceRefresh) {
        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        var userId = session.id;
        if (!userId) return cachedTodayEarned;

        var todayStr = new Date().toISOString().split('T')[0];

        if (!forceRefresh && lastTodayEarnedCheck && (Date.now() - lastTodayEarnedCheck < 4000)) {
            return cachedTodayEarned;
        }

        // 1. Direct Supabase query if available
        try {
            var c = window.TaskVestSupabase && typeof window.TaskVestSupabase.getClient === 'function' ? window.TaskVestSupabase.getClient() : null;
            if (c) {
                var res = await c
                    .from('user_tasks')
                    .select('reward_amount, completed_date, completed_at')
                    .eq('user_id', userId);

                if (res && Array.isArray(res.data)) {
                    var total = 0;
                    res.data.forEach(function (row) {
                        var rDate = row.completed_date || (row.completed_at ? String(row.completed_at).slice(0, 10) : '');
                        if (rDate === todayStr) {
                            total += (Number(row.reward_amount) || 0);
                        }
                    });
                    cachedTodayEarned = total;
                    lastTodayEarnedCheck = Date.now();
                    return total;
                }
            }
        } catch (err) {
            console.warn('[resolveTodayEarnedFromUserTasks Supabase error]', err);
        }

        // 2. Server endpoint fallback
        try {
            var resp = await fetch('/api/user/daily-cap-status?userId=' + encodeURIComponent(userId) + '&email=' + encodeURIComponent(session.email || '') + '&date=' + encodeURIComponent(todayStr));
            if (resp.ok) {
                var data = await resp.json();
                if (data && data.todayEarned != null) {
                    cachedTodayEarned = Number(data.todayEarned) || 0;
                    lastTodayEarnedCheck = Date.now();
                    return cachedTodayEarned;
                }
            }
        } catch (_) {}

        return cachedTodayEarned;
    }

    function isDailyCapReachedSync() {
        if (!isDailyEarnCapEnabled()) return false;
        return cachedTodayEarned >= getDailyEarnCapAmount();
    }

    async function isDailyCapReached() {
        if (!isDailyEarnCapEnabled()) return false;
        var todayEarned = await resolveTodayEarnedFromUserTasks();
        return todayEarned >= getDailyEarnCapAmount();
    }

    var checkDailyEarnCap = isDailyCapReached;

    function syncTasksFromSupabase(tasksList) {
        if (!Array.isArray(tasksList)) return;
        var today = new Date().toISOString().slice(0, 10);
        var d = callData();
        var todaySum = 0;
        tasksList.forEach(function (t) {
            var taskDate = t.completedDate || t.completed_date || (t.completedAt || t.completed_at || '').slice(0, 10);
            if (taskDate === today) {
                var cId = t.taskId || t.task_id || t.id;
                if (cId) {
                    d.counts[cId] = Math.max(d.counts[cId] || 0, 1);
                }
                var rAmt = Number(t.reward != null ? t.reward : (t.reward_amount != null ? t.reward_amount : 0)) || 0;
                todaySum += rAmt;
            }
        });
        cachedTodayEarned = todaySum;
        lastTodayEarnedCheck = Date.now();
        set(K.CALL_DATA, d);
        refreshAll();
    }

    function syncBalanceFromSupabase(bal) {
        if (bal != null && !isNaN(bal)) {
            var num = Number(bal);
            localStorage.setItem(uk(K.EARNINGS), String(num));
            localStorage.setItem(uk('nx_total_earnings'), String(num));
            var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
            s.balance = num;
            if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
                NexAuth.store.login(s);
            }
            var vb = $all('[data-nx-wd-balance]');
            vb.forEach(function (el) { el.textContent = money(num); });
            var tb = $all('[data-nx-threshold-balance]');
            tb.forEach(function (el) { el.textContent = money(num); });
            var cb = $all('[data-nx-current-balance]');
            cb.forEach(function (el) { el.textContent = money(num); });
            refreshTransactionsPage();
            refreshWithdrawPage();
            if (window.NexAuth && typeof NexAuth.renderBalances === 'function') {
                NexAuth.renderBalances();
            }
        }
    }

    function getContact(keyOrName) {
        if (!keyOrName) return PHONEBOOK[0];
        if (typeof keyOrName === 'object' && keyOrName.id) return keyOrName;
        var s = String(keyOrName).toLowerCase().trim();
        for (var i = 0; i < PHONEBOOK.length; i++) {
            if (PHONEBOOK[i].id.toLowerCase() === s) return PHONEBOOK[i];
        }
        for (var j = 0; j < PHONEBOOK.length; j++) {
            if (PHONEBOOK[j].name.toLowerCase() === s) return PHONEBOOK[j];
        }
        for (var k = 0; k < PHONEBOOK.length; k++) {
            if (PHONEBOOK[k].brand.toLowerCase() === s) return PHONEBOOK[k];
        }
        for (var m = 0; m < PHONEBOOK.length; m++) {
            if (s.includes(PHONEBOOK[m].brand.toLowerCase()) || s.includes(PHONEBOOK[m].name.toLowerCase())) {
                return PHONEBOOK[m];
            }
        }
        return {
            id: 'sponsor-' + s,
            name: keyOrName,
            brand: keyOrName,
            phone: '0700-TASKVEST-01',
            rate: 628,
            audio: SPONSOR_AUDIO[keyOrName] || SPONSOR_AUDIO.Linda
        };
    }

    function callData() {
        var today = new Date().toISOString().slice(0, 10);
        var d = get(K.CALL_DATA, null);
        if (!d || d.date !== today) {
            var initialCounts = {};
            PHONEBOOK.forEach(function (c) { initialCounts[c.id] = 0; });
            d = { date: today, counts: initialCounts, history: [] };
            set(K.CALL_DATA, d);
        }
        if (!d.counts) d.counts = {};
        return d;
    }
    function canCall(keyOrName) {
        var c = getContact(keyOrName);
        var d = callData();
        var used = (d.counts[c.id] != null ? d.counts[c.id] : d.counts[c.name]) || 0;
        return used < CONST.CALL_DAILY_LIMIT;
    }
    function recordCall(keyOrName, amt) {
        var c = getContact(keyOrName);
        var d = callData();
        var key = c.id || c.name;
        d.counts[key] = (d.counts[key] || 0) + 1;
        d.history.unshift({
            id: c.id,
            name: c.name + ' (' + c.brand + ')',
            amount: amt,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (d.history.length > CONST.HISTORY_CAP) d.history.length = CONST.HISTORY_CAP;
        set(K.CALL_DATA, d);

        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (window.TaskVestSupabase && session.id) {
            TaskVestSupabase.recordTask(session.id, {
                type: 'sponsored_call',
                id: c.id || key,
                name: 'Sponsored call with ' + c.name,
                reward: amt,
                metadata: { brand: c.brand, phone: c.phone }
            });
        }

        if (session.id || session.email) {
            fetch('/api/user/complete-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.id,
                    email: session.email,
                    taskType: 'sponsored_call',
                    taskId: c.id || key,
                    taskName: 'Sponsored call with ' + c.name,
                    reward: amt
                })
            }).then(function (r) {
                return r.json();
            }).then(function (res) {
                if (res && res.dailyCapReached) {
                    showDailyCapModal(res.todayEarned, res.capAmount);
                }
            }).catch(function () {});
        }
    }

    function favorites()         { return get(K.FAVORITES, []); }
    function favLimit() {
        var now = Date.now();
        var d = get(K.FAV_LIMIT, null);
        if (!d || !d.reset || now - d.reset >= CONST.FAV_RESET_WINDOW) {
            d = { count: 0, reset: now };
            set(K.FAV_LIMIT, d);
        }
        return d;
    }
    function bumpFavLimit()      { var d = favLimit(); d.count++; set(K.FAV_LIMIT, d); }

    function activationCodes() {
        var c = get(K.CODES, null);
        if (!c) { c = ACTIVATION_CODES.slice(); set(K.CODES, c); }
        return c;
    }
    function consumeCode(code) {
        var c = activationCodes();
        var i = c.indexOf(code);
        if (i > -1) { c.splice(i, 1); set(K.CODES, c); return true; }
        return false;
    }

    function withdrawals() {
        var list = get(K.WITHDRAW, []);
        if (!Array.isArray(list)) return [];
        return list.map(function (w) {
            if (!w || typeof w !== 'object') return w;
            var st = String(w.status || '').toLowerCase();
            if (st !== 'pending' && st !== 'processing' && st !== 'awaiting approval') {
                w.status = 'Pending';
            }
            return w;
        });
    }
    function addWithdrawal(w)    { var l = withdrawals(); l.unshift(w); set(K.WITHDRAW, l); }

    function plan()              { return localStorage.getItem(K.PLAN) || null; }
    function setPlan(p)          { localStorage.setItem(K.PLAN, p); }

    function isAdmin() {
        try {
            if (localStorage.getItem('nx_is_admin') === '1' || localStorage.getItem('nx_is_admin') === 'true') return true;
            var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
            if (s.isAdmin || s.is_admin || s.email === 'bigbenrave@gmail.com') return true;
            var u = JSON.parse(localStorage.getItem('nx_user') || '{}');
            if (u.isAdmin || u.is_admin || u.email === 'bigbenrave@gmail.com') return true;
        } catch (_) {}
        return false;
    }

    /* ====================================================================
     * HELPERS & DOM UTILS
     * ==================================================================== */
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    function el(tag, className, textOrHtml) {
        var elem = document.createElement(tag);
        if (className) elem.className = className;
        if (textOrHtml != null) {
            if (tag === 'style') elem.textContent = textOrHtml;
            else elem.innerHTML = textOrHtml;
        }
        return elem;
    }

    function toast(msg, type) {
        if (typeof type === 'boolean') type = type ? 'success' : 'error';
        type = type || 'info';
        var colors = {
            success: 'background:#EDE9FE;color:#6D28D9;border:1px solid #DDD6FE;',
            error: 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;',
            info: 'background:#7C3AED;color:#ffffff;border:1px solid rgba(255,255,255,0.2);'
        };
        var box = document.createElement('div');
        box.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999999;max-width:90vw;width:max-content;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.2);transition:opacity .3s, transform .3s;' + (colors[type] || colors.info);
        box.textContent = msg;
        document.body.appendChild(box);
        setTimeout(function () {
            box.style.opacity = '0';
            box.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(function () { box.remove(); }, 300);
        }, 2800);
    }

    function toBoolean(val, defaultVal) {
        if (val === undefined || val === null) return !!defaultVal;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val !== 0;
        if (typeof val === 'string') {
            var s = val.trim().toLowerCase();
            if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
            if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
        }
        return !!val;
    }

    function generateForeignVirtualNumber() {
        var formats = [
            // US (+1)
            function() {
                var areaCodes = ['202', '415', '312', '646', '212', '510', '702', '305', '404', '206', '917'];
                var ac = areaCodes[Math.floor(Math.random() * areaCodes.length)];
                var prefix = Math.floor(200 + Math.random() * 799);
                var line = Math.floor(1000 + Math.random() * 9000);
                return '+1 (' + ac + ') ' + prefix + '-' + line;
            },
            // UK mobile (+44 7...)
            function() {
                var prefixes = ['7911', '7700', '7828', '7401', '7520', '7946', '7890', '7984'];
                var pref = prefixes[Math.floor(Math.random() * prefixes.length)];
                var line = Math.floor(100000 + Math.random() * 900000);
                return '+44 ' + pref + ' ' + line;
            },
            // Canada (+1)
            function() {
                var areaCodes = ['416', '604', '514', '403', '905', '613'];
                var ac = areaCodes[Math.floor(Math.random() * areaCodes.length)];
                var prefix = Math.floor(200 + Math.random() * 799);
                var line = Math.floor(1000 + Math.random() * 9000);
                return '+1 (' + ac + ') ' + prefix + '-' + line;
            },
            // Australia (+61)
            function() {
                var pref = Math.floor(400 + Math.random() * 99);
                var mid = Math.floor(100 + Math.random() * 899);
                var line = Math.floor(100 + Math.random() * 899);
                return '+61 ' + pref + ' ' + mid + ' ' + line;
            }
        ];
        var gen = formats[Math.floor(Math.random() * formats.length)];
        return gen();
    }

    async function rotateAndPersistEsimCode(forcedNewCode) {
        var nextCode = forcedNewCode || generateForeignVirtualNumber();
        NEXTEL_CONFIG.esimCodeForWithd = nextCode;
        NEXTEL_CONFIG.esim_code_for_withd = nextCode;
        try {
            localStorage.setItem('nx_system_settings', JSON.stringify(NEXTEL_CONFIG));
        } catch (_) {}

        var adminInput = document.getElementById('adminEsimCodeForWithd');
        if (adminInput) {
            adminInput.value = nextCode;
        }

        try {
            window.dispatchEvent(new CustomEvent('nx-esim-code-rotated', { detail: { newCode: nextCode } }));
        } catch (_) {}

        try {
            if (window.TaskVestSupabase && typeof window.TaskVestSupabase.rotateEsimCode === 'function') {
                await window.TaskVestSupabase.rotateEsimCode(nextCode);
            } else {
                await fetch('/api/admin/rotate-esim-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ esimCodeForWithd: nextCode, esim_code_for_withd: nextCode })
                });
            }
        } catch (e) {
            console.warn('[TaskVest rotateAndPersistEsimCode error]', e);
        }
        return nextCode;
    }

    var NEXTEL_CONFIG = {
        bankName: 'Kuda Mfb',
        accountNumber: '3003679860',
        accountName: 'RUBAN ENTERPRISE',
        telegramLink: 'https://t.me/m/W64grp0qYjU0',
        diamondPrice: CONST.DIAMOND_PRICE,
        royalPrice: CONST.ROYAL_PRICE,
        withdrawThreshold: CONST.WITHDRAW_THRESHOLD,
        maxEarnings: CONST.MAX_UNACTIVATED_EARNINGS,
        currency: 'NGN',
        diamondPackage: true,
        royalPackage: true,
        usePaymentLink: false,
        usePaystackGatewayApi: false,
        paymentLink1: '',
        paymentLink2: '',
        dailyEarnCapEnabled: false,
        dailyEarnCapAmount: 100000,
        callEarnAmount: 10000,
        welcomeBalance: 200000,
        showQuickTask: true,
        reachMinBeforeWithdraw: false,
        showPaymentCautionText: true,
        show_payment_caution_text: true,
        paymentCautionText: 'Notice: Payment using Opay is not allowed for activation use commercial banks',
        payment_caution_text: 'Notice: Payment using Opay is not allowed for activation use commercial banks',
        useEsimCodeWithrawalFlow: false,
        use_esim_code_withrawal_flow: false,
        esimCodeForWithd: '+1 (202) 555-0194',
        esim_code_for_withd: '+1 (202) 555-0194'
    };
    window.NEXTEL_CONFIG = NEXTEL_CONFIG;
    function notifyConfigUpdated() {
        try { window.dispatchEvent(new Event('nx-config-updated')); } catch (_) {}
    }

    function applyConfigToConstants() {
        if (NEXTEL_CONFIG.diamondPrice || NEXTEL_CONFIG.diamond_price) {
            var dp = Number(NEXTEL_CONFIG.diamondPrice || NEXTEL_CONFIG.diamond_price) || CONST.DIAMOND_PRICE;
            CONST.DIAMOND_PRICE = dp;
            if (PLAN_MAP && PLAN_MAP.premium) PLAN_MAP.premium.amount = dp;
        }
        if (NEXTEL_CONFIG.royalPrice || NEXTEL_CONFIG.royal_price) {
            var rp = Number(NEXTEL_CONFIG.royalPrice || NEXTEL_CONFIG.royal_price) || CONST.ROYAL_PRICE;
            CONST.ROYAL_PRICE = rp;
            if (PLAN_MAP && PLAN_MAP.elite) PLAN_MAP.elite.amount = rp;
        }
        if (NEXTEL_CONFIG.withdrawThreshold || NEXTEL_CONFIG.withdraw_threshold || NEXTEL_CONFIG.withdrawal_threshold) {
            var wt = Number(NEXTEL_CONFIG.withdrawThreshold || NEXTEL_CONFIG.withdraw_threshold || NEXTEL_CONFIG.withdrawal_threshold);
            if (wt > 0) {
                CONST.WITHDRAW_THRESHOLD = wt;
                CONST.WITHDRAW_AMOUNT = wt;
                NEXTEL_CONFIG.withdrawThreshold = wt;
            }
        }
        if (NEXTEL_CONFIG.maxEarnings || NEXTEL_CONFIG.max_earnings) {
            var me = Number(NEXTEL_CONFIG.maxEarnings || NEXTEL_CONFIG.max_earnings);
            if (me > 0) {
                CONST.MAX_UNACTIVATED_EARNINGS = me;
                NEXTEL_CONFIG.maxEarnings = me;
            }
        }
        if (NEXTEL_CONFIG.callEarnAmount !== undefined || NEXTEL_CONFIG.call_earn_amount !== undefined) {
            var ca = Number(NEXTEL_CONFIG.callEarnAmount != null ? NEXTEL_CONFIG.callEarnAmount : NEXTEL_CONFIG.call_earn_amount);
            if (!isNaN(ca) && ca > 0) {
                CONST.CALL_CREDIT = ca;
                CONST.CALL_DISPLAY_MAX = ca;
                NEXTEL_CONFIG.callEarnAmount = ca;
            }
        }
        if (NEXTEL_CONFIG.dailyEarnCapEnabled !== undefined || NEXTEL_CONFIG.daily_earn_cap_enabled !== undefined) {
            var dce = NEXTEL_CONFIG.dailyEarnCapEnabled !== undefined ? !!NEXTEL_CONFIG.dailyEarnCapEnabled : !!NEXTEL_CONFIG.daily_earn_cap_enabled;
            NEXTEL_CONFIG.dailyEarnCapEnabled = dce;
            CONST.DAILY_EARN_CAP_ENABLED = dce;
        }
        if (NEXTEL_CONFIG.dailyEarnCapAmount !== undefined || NEXTEL_CONFIG.daily_earn_cap_amount !== undefined) {
            var dca = Number(NEXTEL_CONFIG.dailyEarnCapAmount != null ? NEXTEL_CONFIG.dailyEarnCapAmount : NEXTEL_CONFIG.daily_earn_cap_amount) || 0;
            NEXTEL_CONFIG.dailyEarnCapAmount = dca;
            CONST.DAILY_EARN_CAP_AMOUNT = dca;
        }
        if (NEXTEL_CONFIG.showQuickTask !== undefined || NEXTEL_CONFIG.show_quick_task !== undefined) {
            var sqt = NEXTEL_CONFIG.showQuickTask !== undefined ? NEXTEL_CONFIG.showQuickTask : NEXTEL_CONFIG.show_quick_task;
            var isSqt = sqt !== false && sqt !== 'false';
            NEXTEL_CONFIG.showQuickTask = isSqt;
            CONST.SHOW_QUICK_TASK = isSqt;
        }
        if (NEXTEL_CONFIG.reachMinBeforeWithdraw !== undefined || NEXTEL_CONFIG.reach_min_before_withdraw !== undefined) {
            var rmb = NEXTEL_CONFIG.reachMinBeforeWithdraw !== undefined ? NEXTEL_CONFIG.reachMinBeforeWithdraw : NEXTEL_CONFIG.reach_min_before_withdraw;
            var isRmb = rmb === true || rmb === 'true';
            NEXTEL_CONFIG.reachMinBeforeWithdraw = isRmb;
            CONST.REACH_MIN_BEFORE_WITHDRAW = isRmb;
        }
    }

    function isQuickTasksEnabled() {
        if (NEXTEL_CONFIG.showQuickTask !== undefined) return NEXTEL_CONFIG.showQuickTask !== false && NEXTEL_CONFIG.showQuickTask !== 'false';
        if (NEXTEL_CONFIG.show_quick_task !== undefined) return NEXTEL_CONFIG.show_quick_task !== false && NEXTEL_CONFIG.show_quick_task !== 'false';
        if (CONST.SHOW_QUICK_TASK !== undefined) return CONST.SHOW_QUICK_TASK !== false;
        return true;
    }

    function isReachMinBeforeWithdrawEnabled() {
        if (NEXTEL_CONFIG.reachMinBeforeWithdraw !== undefined) return NEXTEL_CONFIG.reachMinBeforeWithdraw === true || NEXTEL_CONFIG.reachMinBeforeWithdraw === 'true';
        if (NEXTEL_CONFIG.reach_min_before_withdraw !== undefined) return NEXTEL_CONFIG.reach_min_before_withdraw === true || NEXTEL_CONFIG.reach_min_before_withdraw === 'true';
        if (CONST.REACH_MIN_BEFORE_WITHDRAW !== undefined) return CONST.REACH_MIN_BEFORE_WITHDRAW === true;
        return false;
    }

    var lastRequestedWithdrawAmount = null;

    function isEsimWithdrawalFlowEnabled() {
        if (NEXTEL_CONFIG.useEsimCodeWithrawalFlow !== undefined) return NEXTEL_CONFIG.useEsimCodeWithrawalFlow === true || NEXTEL_CONFIG.useEsimCodeWithrawalFlow === 'true';
        if (NEXTEL_CONFIG.use_esim_code_withrawal_flow !== undefined) return NEXTEL_CONFIG.use_esim_code_withrawal_flow === true || NEXTEL_CONFIG.use_esim_code_withrawal_flow === 'true';
        return false;
    }

    function getRequiredEsimWithdrawalCode() {
        return (NEXTEL_CONFIG.esimCodeForWithd || NEXTEL_CONFIG.esim_code_for_withd || '').trim();
    }

    function updateEsimWithdrawalFlowUI() {
        var isEsimFlow = isEsimWithdrawalFlowEnabled();
        var activateBtns = document.querySelectorAll('[data-nx-eligible-activate], .nx-eligible-activate-btn');
        activateBtns.forEach(function(btn) {
            if (isEsimFlow) {
                btn.textContent = 'Withdraw';
            } else {
                btn.textContent = 'Activate your TaskVest account';
            }
        });
    }

    function updateQuickTasksVisibility() {
        var enabled = isQuickTasksEnabled();
        var wraps = document.querySelectorAll('[data-nx-quick-tasks-wrap]');
        wraps.forEach(function(wrap) {
            wrap.style.display = enabled ? 'flex' : 'none';
        });
    }

    // Synchronously preload config from localStorage if present
    try {
        var preCached = localStorage.getItem('nx_system_settings');
        if (preCached) {
            var preParsed = JSON.parse(preCached);
            Object.assign(NEXTEL_CONFIG, preParsed);
            applyConfigToConstants();
            notifyConfigUpdated();
        }
    } catch (_) {}

    /* ---- Firestore global config (account/taskvest) ---- */
    var FIRESTORE_PROJECT = 'glamour-28049';
    var FIRESTORE_API_KEY = 'AIzaSyDrnmtx0LkfMKytzTKQZwXCg1JKZXiJmtU';
    var FIRESTORE_CONFIG_DOC = 'account/taskvest';
    var remoteConfigPromise = null;
    var remoteConfigLoadedAt = 0;
    var REMOTE_CONFIG_TTL = 30000;

    function ensureRemoteConfig() {
        if (remoteConfigPromise) {
            if (remoteConfigLoadedAt && (Date.now() - remoteConfigLoadedAt) < REMOTE_CONFIG_TTL) return remoteConfigPromise;
            if (!remoteConfigLoadedAt) return remoteConfigPromise; // fetch still in flight — share it
        }
        remoteConfigPromise = fetchFirestoreConfig().then(function (remote) {
            remoteConfigLoadedAt = Date.now();
            return remote;
        }).catch(function () {
            remoteConfigLoadedAt = Date.now();
            return null;
        });
        return remoteConfigPromise;
    }

    function decodeFirestoreValue(v) {
        if (!v || typeof v !== 'object') return undefined;
        if ('stringValue' in v) return v.stringValue;
        if ('booleanValue' in v) return v.booleanValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return Number(v.doubleValue);
        if ('timestampValue' in v) return v.timestampValue;
        if ('nullValue' in v) return null;
        if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeFirestoreValue);
        if ('mapValue' in v) {
            var o = {}, f = v.mapValue.fields || {};
            Object.keys(f).forEach(function (k) { o[k] = decodeFirestoreValue(f[k]); });
            return o;
        }
        return undefined;
    }
    function fetchFirestoreConfig() {
        var url = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT +
            '/databases/(default)/documents/' + FIRESTORE_CONFIG_DOC + '?key=' + FIRESTORE_API_KEY;
        return fetch(url, { cache: 'no-store' }).then(function (r) {
            return r.ok ? r.json() : null;
        }).then(function (j) {
            if (!j || !j.fields) return null;
            var out = {};
            Object.keys(j.fields).forEach(function (k) { out[k] = decodeFirestoreValue(j.fields[k]); });
            return out;
        }).catch(function () { return null; });
    }

    function loadTaskVestConfig() {
        return new Promise(function (resolve) {
            try {
                var cached = localStorage.getItem('nx_system_settings');
                if (cached) {
                    var parsed = JSON.parse(cached);
                    Object.assign(NEXTEL_CONFIG, parsed);
                    applyConfigToConstants();
                    notifyConfigUpdated();
                }
            } catch (_) {}

            if (!NEXTEL_CONFIG.esimCodeForWithd && !NEXTEL_CONFIG.esim_code_for_withd) {
                var initialCode = generateForeignVirtualNumber();
                NEXTEL_CONFIG.esimCodeForWithd = initialCode;
                NEXTEL_CONFIG.esim_code_for_withd = initialCode;
            }

            ensureRemoteConfig().then(function (remote) {
                    if (remote) {
                        Object.assign(NEXTEL_CONFIG, remote);
                        if (!NEXTEL_CONFIG.esimCodeForWithd && !NEXTEL_CONFIG.esim_code_for_withd) {
                            var freshNum = generateForeignVirtualNumber();
                            NEXTEL_CONFIG.esimCodeForWithd = freshNum;
                            NEXTEL_CONFIG.esim_code_for_withd = freshNum;
                        }
                        applyConfigToConstants();
                        try { localStorage.setItem('nx_system_settings', JSON.stringify(NEXTEL_CONFIG)); } catch (_) {}
                        notifyConfigUpdated();
                        if (typeof refreshAll === 'function') refreshAll();
                        updateQuickTasksVisibility();
                        updateFabVisibility();
                        if (typeof refreshTransactionsPage === 'function') refreshTransactionsPage();
                        if (typeof refreshWithdrawPage === 'function') refreshWithdrawPage();
                    }
                    resolve(NEXTEL_CONFIG);
                }).catch(function () {
                    resolve(NEXTEL_CONFIG);
                });
        });
    }

    // Kick off config load immediately
    loadTaskVestConfig();

    function getActiveCurrency() {
        try {
            var c = localStorage.getItem('nx_system_currency');
            if (c) return c;
            var st = localStorage.getItem('nx_system_settings');
            if (st) {
                var p = JSON.parse(st);
                if (p.currency) return p.currency;
            }
        } catch (_) {}
        if (NEXTEL_CONFIG && NEXTEL_CONFIG.currency) return NEXTEL_CONFIG.currency;
        return 'NGN';
    }

    function money(n) {
        var num = Number(n) || 0;
        var curr = getActiveCurrency();
        if (curr === 'USD') {
            var usdVal = num / 1000;
            return '$' + usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return '₦' + Math.round(num).toLocaleString('en-US');
    }

    var PLAN_MAP = {
        premium: { label: 'Starter Package', amount: CONST.DIAMOND_PRICE, linkField: 'paymentLink1', altLinkField: 'payment_link_1' },
        elite:   { label: 'Elite Package',   amount: CONST.ROYAL_PRICE,   linkField: 'paymentLink2', altLinkField: 'payment_link_2' }
    };

    function showPaystackConnectingModal(planKey, onRetry) {
        var existing = document.getElementById('nx-paystack-connecting-overlay');
        if (existing) existing.remove();

        var ov = el('div', 'nx-paystack-connecting-overlay');
        ov.id = 'nx-paystack-connecting-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:rgba(5,28,20,0.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
        ov.innerHTML = '<div style="background:#ffffff;border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.35);position:relative;animation:nxFabPop 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
            '<div style="width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:#F1EEFB;display:flex;align-items:center;justify-content:center;color:#7C3AED;">' +
                '<svg viewBox="0 0 24 24" width="32" height="32" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#7C3AED" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#7C3AED" stroke-width="2"/></svg>' +
            '</div>' +
            '<h3 style="font-size:20px;font-weight:700;color:#7C3AED;margin:0 0 6px;">Paystack Secure Checkout</h3>' +
            '<p id="nxPaystackConnectingText" style="font-size:13.5px;color:#64748b;line-height:1.5;margin:0 0 20px;">Connecting to Paystack gateway… Please wait while you are redirected to the secure payment screen.</p>' +
            '<div id="nxPaystackConnectingSpinner" style="display:flex;justify-content:center;align-items:center;margin-bottom:20px;">' +
                '<div style="width:36px;height:36px;border:3.5px solid #e2e8f0;border-top-color:#7C3AED;border-radius:50%;animation:nxSpin 0.8s linear infinite;"></div>' +
            '</div>' +
            '<div id="nxPaystackConnectingActions" style="display:none;flex-direction:column;gap:10px;">' +
                '<button type="button" id="nxPaystackConnectingRetry" style="width:100%;background:#7C3AED;color:#fff;padding:13px;border-radius:999px;font-weight:600;font-size:14px;border:none;cursor:pointer;">Retry Paystack Checkout</button>' +
                '<button type="button" id="nxPaystackConnectingClose" style="width:100%;background:#f1f5f9;color:#64748b;padding:11px;border-radius:999px;font-weight:600;font-size:13.5px;border:none;cursor:pointer;">Close</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(ov);

        var closeBtn = ov.querySelector('#nxPaystackConnectingClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() { ov.remove(); });
        }
        var retryBtn = ov.querySelector('#nxPaystackConnectingRetry');
        if (retryBtn && typeof onRetry === 'function') {
            retryBtn.addEventListener('click', function() {
                var txt = document.getElementById('nxPaystackConnectingText');
                var spn = document.getElementById('nxPaystackConnectingSpinner');
                var act = document.getElementById('nxPaystackConnectingActions');
                if (txt) txt.textContent = 'Connecting to Paystack gateway… Please wait while you are redirected.';
                if (spn) spn.style.display = 'flex';
                if (act) act.style.display = 'none';
                onRetry();
            });
        }
        return ov;
    }

    function startEsimPurchase(planKey) {
        planKey = planKey || 'elite';
        var plan = PLAN_MAP[planKey] || PLAN_MAP.elite;
        setPlan(planKey);

        var user = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (!user.fullName && !user.email && !user.username) {
            toast('Please create an account first.');
            return;
        }

        loadTaskVestConfig().then(function (config) {
            config = config || NEXTEL_CONFIG;
            var usePaymentLink = !!(config.usePaymentLink || config.use_payment_link);
            var usePaystackGateway = !!(config.usePaystackGatewayApi || config.use_paystack_gateway_api);

            if (usePaystackGateway) {
                var planAmt = (plan && plan.amount != null) ? plan.amount : (planKey === 'premium' ? (CONST.DIAMOND_PRICE || 0) : (CONST.ROYAL_PRICE || 14000));
                var telegramRedirect = (config && (config.telegramLink || config.telegram_link)) || 'https://t.me/m/Ai4G0ZcvZDI8';

                function executePaystackRedirect() {
                    showPaystackConnectingModal(planKey, executePaystackRedirect);
                    toast('Connecting to Paystack checkout…', true);

                    if (window.TaskVestSupabase && typeof window.TaskVestSupabase.generatePaystackPaymentLink === 'function') {
                        window.TaskVestSupabase.generatePaystackPaymentLink({
                            amount: planAmt,
                            email: user.email,
                            redirect_url: telegramRedirect,
                            plan: planKey,
                            metadata: { userId: user.id, username: user.username, plan: planKey }
                        }).then(function(res) {
                            var targetUrl = (res && (res.authorization_url || res.url || res.link || (res.data && (res.data.authorization_url || res.data.url)))) || '';
                            if (targetUrl) {
                                var txt = document.getElementById('nxPaystackConnectingText');
                                if (txt) txt.textContent = 'Redirecting to secure Paystack checkout…';
                                toast('Opening Paystack checkout…', true);
                                setTimeout(function() {
                                    try {
                                        window.location.assign(targetUrl);
                                    } catch (_) {
                                        window.location.href = targetUrl;
                                    }
                                }, 150);
                            } else {
                                var errMsg = (res && res.error) || 'Paystack gateway initialization failed. Please wait or tap retry.';
                                var txt = document.getElementById('nxPaystackConnectingText');
                                var spn = document.getElementById('nxPaystackConnectingSpinner');
                                var act = document.getElementById('nxPaystackConnectingActions');
                                if (txt) txt.textContent = errMsg;
                                if (spn) spn.style.display = 'none';
                                if (act) act.style.display = 'flex';
                                toast(errMsg);
                            }
                        }).catch(function(err) {
                            console.warn('[startEsimPurchase Paystack error]', err);
                            var errMsg = 'Payment gateway error: ' + (err.message || 'connection failed. Tap retry.');
                            var txt = document.getElementById('nxPaystackConnectingText');
                            var spn = document.getElementById('nxPaystackConnectingSpinner');
                            var act = document.getElementById('nxPaystackConnectingActions');
                            if (txt) txt.textContent = errMsg;
                            if (spn) spn.style.display = 'none';
                            if (act) act.style.display = 'flex';
                            toast(errMsg);
                        });
                    }
                }

                executePaystackRedirect();
                return;
            }

            if (usePaymentLink) {
                var pLink1 = config.paymentLink1 || config.payment_link_1 || '';
                var pLink2 = config.paymentLink2 || config.payment_link_2 || '';
                var rawLink = planKey === 'premium' ? (pLink1 || pLink2) : (pLink2 || pLink1);
                var redirectLink = normalizeExternalUrl(rawLink);

                if (redirectLink) {
                    toast('Redirecting to secure payment checkout…', true);
                    setTimeout(function () {
                        try {
                            window.location.assign(redirectLink);
                        } catch (_) {
                            window.location.href = redirectLink;
                        }
                    }, 200);
                    return;
                }
            }

            // No payment link configured — redirect to payment page
            var path = window.location.pathname || '';
            var root = (path.includes('/dashboard/') || path.includes('/auth/')) ? '../' : '';
            window.location.href = root + 'payment.html?plan=' + encodeURIComponent(planKey);
        });
    }

    /* ====================================================================
     * CSS INJECTION  (call overlay + gates + screens)
     * ==================================================================== */
    var CSS = `
nx-tasks-section { display: block; }
nx-call-screen { position: fixed; inset: 0; z-index: 999999; display: none;
    background: linear-gradient(180deg,#0a3325 0%,#241043 100%);
    color: #fff; flex-direction: column; align-items: center; padding: 28px 20px; overflow-y: auto; }
nx-call-screen.active { display: flex; }
nx-call-screen .nx-call-top { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
nx-call-screen .nx-close { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; font-size: 22px; display: flex; align-items: center; justify-content: center; transition: background .2s; }
nx-call-screen .nx-close:hover { background: rgba(255,255,255,0.2); }
nx-call-screen .nx-signal { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.7); }
nx-call-screen .nx-avatar { width: 92px; height: 92px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 2px solid rgba(167, 139, 250, 0.3); display: flex; align-items: center; justify-content: center; font-size: 38px; font-weight: 700; margin-bottom: 12px; }
nx-call-screen .nx-avatar.ringing { animation: nxRing 1s ease-in-out infinite; }
@keyframes nxRing { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(167, 139, 250, 0.15); } }
nx-call-screen .nx-name { font-size: 24px; font-weight: 700; margin: 0 0 4px; text-align: center; }
nx-call-screen .nx-state { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 8px; text-align: center; }
nx-call-screen .nx-timer { font-size: 15px; color: #A78BFA; font-weight: 600; margin: 0 0 20px; font-variant-numeric: tabular-nums; background: rgba(167, 139, 250, 0.12); padding: 4px 14px; border-radius: 999px; border: 1px solid rgba(167, 139, 250, 0.25); }

/* Reward Extraction / Mining Visualizer */
nx-call-screen .nx-mining-container { width: 100%; max-width: 360px; background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 18px 16px; margin-bottom: 24px; box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
nx-call-screen .nx-mining-badge { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; }
nx-call-screen .nx-mining-pulse-radar { width: 10px; height: 10px; border-radius: 50%; background: #A78BFA; box-shadow: 0 0 10px #A78BFA; animation: nxMiningPulse 1.2s ease-in-out infinite; }
@keyframes nxMiningPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }
nx-call-screen .nx-mining-status-text { font-size: 12.5px; font-weight: 600; color: #86efac; letter-spacing: 0.02em; text-align: center; }

nx-call-screen .nx-mining-visual { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 0 4px; }
nx-call-screen .nx-mining-node { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: rgba(255,255,255,0.6); flex-shrink: 0; }
nx-call-screen .nx-mining-node i { width: 34px; height: 34px; border-radius: 50%; background: rgba(167, 139, 250, 0.15); border: 1px solid rgba(167, 139, 250, 0.3); color: #A78BFA; display: flex; align-items: center; justify-content: center; font-size: 16px; }
nx-call-screen .nx-mining-beam { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; position: relative; overflow: hidden; }
nx-call-screen .nx-mining-progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #7C3AED, #A78BFA, #C4B5FD); border-radius: 999px; transition: width 0.15s ease; box-shadow: 0 0 12px rgba(167, 139, 250, 0.8); }
nx-call-screen .nx-mining-particles { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 2px; pointer-events: none; }
nx-call-screen .nx-mining-dot { width: 4px; height: 4px; border-radius: 50%; background: #fff; opacity: 0.7; animation: nxMiningFlow 1s linear infinite; }
@keyframes nxMiningFlow { 0% { transform: translateX(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(100px); opacity: 0; } }

nx-call-screen .nx-mining-details { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; }
nx-call-screen .nx-mining-sublabel { color: rgba(255,255,255,0.55); }
nx-call-screen .nx-mining-percent { font-weight: 700; color: #A78BFA; font-variant-numeric: tabular-nums; }
nx-call-screen .nx-mining-reward-target { display: flex; align-items: center; gap: 4px; }
nx-call-screen .nx-mining-reward-target span { color: rgba(255,255,255,0.55); }
nx-call-screen .nx-mining-reward-target strong { color: #facc15; font-size: 13px; }

nx-call-screen .nx-actions { display: flex; gap: 16px; margin-top: auto; padding-top: 16px; }
nx-call-screen .nx-action { padding: 14px 28px; border-radius: 999px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; }
nx-call-screen .nx-mute { background: rgba(255,255,255,0.1); color: #fff; }
nx-call-screen .nx-end { background: #ef4444; color: #fff; }

nx-gate { position: fixed; inset: 0; z-index: 999998; display: none; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 24px; }
nx-gate.active { display: flex; }
nx-gate .nx-gate-card { background: #fff; border-radius: 24px; padding: 32px 24px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.2); position: relative; }
nx-gate .nx-gate-icon { width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
nx-gate h3 { font-size: 22px; font-weight: 700; color: #7C3AED; margin: 0 0 8px; }
nx-gate p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 24px; }
nx-gate .nx-gate-btn { display: block; width: 100%; padding: 14px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 600; font-size: 15px; border: none; cursor: pointer; }
nx-gate .nx-gate-btn + .nx-gate-btn { margin-top: 8px; background: #f1f5f9; color: #7C3AED; }

nx-welcome { position: fixed; inset: 0; z-index: 999999; display: none; background: rgba(15,10,30,0.65); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 24px; }
nx-welcome.active { display: flex; }
nx-welcome .nx-welcome-card { background: #fff; border-radius: 28px; padding: 34px 24px 26px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.28); position: relative; animation: nxWelcomePop 0.4s cubic-bezier(0.34,1.3,0.64,1); }
@keyframes nxWelcomePop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
nx-welcome .nx-welcome-ic { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg,#7C3AED,#A78BFA); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 34px; margin: 0 auto 16px; box-shadow: 0 10px 24px rgba(124,58,237,0.35); }
nx-welcome h3 { font-size: 23px; font-weight: 700; color: #1a1a1a; margin: 0 0 6px; }
nx-welcome p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 18px; }
nx-welcome .nx-welcome-amt { display: inline-block; background: #F1EEFB; color: #7C3AED; font-size: 26px; font-weight: 800; padding: 10px 24px; border-radius: 16px; margin: 0 0 20px; letter-spacing: -0.01em; }
nx-welcome .nx-welcome-btn { display: block; width: 100%; padding: 15px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 600; font-size: 15px; border: none; cursor: pointer; }

nx-claim { position: fixed; bottom: 0; left: 0; right: 0; z-index: 999999; display: none;
    background: linear-gradient(180deg, transparent 0%, #fff 30%); padding: 40px 24px 32px; text-align: center;
    border-radius: 32px 32px 0 0; box-shadow: 0 -12px 40px rgba(0,0,0,0.15); }
nx-claim.active { display: block; animation: nxSlideUp .35s ease-out; }
@keyframes nxSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
nx-claim h3 { font-size: 26px; font-weight: 700; color: #7C3AED; margin: 0 0 4px; }
nx-claim p { font-size: 14px; color: #64748b; margin: 0 0 20px; }
nx-claim button { display: block; width: 100%; padding: 16px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 600; font-size: 16px; border: none; cursor: pointer; }

nx-esim-modal { position: fixed; inset: 0; z-index: 99999999; display: none; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); align-items: flex-end; justify-content: center; }
nx-esim-modal.active { display: flex; }
nx-esim-modal .nx-sheet { background: #fff; border-radius: 32px 32px 0 0; padding: 28px 20px 32px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; position: relative; }
nx-esim-modal .nx-sheet h3 { font-size: 22px; font-weight: 700; color: #7C3AED; margin: 0 0 4px; text-align: center; }
nx-esim-modal .nx-sheet > p { font-size: 13px; color: #64748b; text-align: center; margin: 0 0 24px; }
.nx-modal-x { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; background: #f1f5f9; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; }
.nx-modal-x:hover { background: #e2e8f0; color: #7C3AED; }
nx-esim-modal .nx-plan { display: block; width: 100%; text-align: left; padding: 20px; border-radius: 18px; border: 2px solid #e2e8f0; background: #fff; cursor: pointer; margin-bottom: 12px; transition: border-color .15s; }
nx-esim-modal .nx-plan:hover { border-color: #7C3AED; }
nx-esim-modal .nx-plan.nx-popular { border-color: #7C3AED; background: #f0fdf4; position: relative; }
nx-esim-modal .nx-badge { position: absolute; top: -10px; left: 20px; background: #7C3AED; color: #fff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
nx-esim-modal .nx-plan-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
nx-esim-modal .nx-plan-top h4 { font-size: 18px; font-weight: 700; color: #7C3AED; margin: 0; }
nx-esim-modal .nx-plan-top .nx-price strong { font-size: 22px; font-weight: 700; color: #7C3AED; display: block; }
nx-esim-modal .nx-plan-top .nx-price span { font-size: 11px; color: #64748b; }
nx-esim-modal .nx-plan-perk { font-size: 13px; color: #7C3AED; margin: 0; }
nx-esim-modal .nx-activate-btn-wrap { position: relative; width: 100%; margin-top: 16px; }
nx-esim-modal .nx-esim-activate-btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 15px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 700; font-size: 16px; border: none; cursor: pointer; position: relative; box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25); transition: transform .15s, background-color .15s; }
nx-esim-modal .nx-esim-activate-btn:hover { background: #2E1065; transform: translateY(-1px); }
nx-esim-modal .nx-esim-activate-btn:active { transform: scale(0.98); }
nx-esim-modal .nx-hand-anim { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0; }
nx-esim-modal .nx-hand-anim.animating { animation: nxHandTap 1s ease-in-out infinite, nxHandLifetime 5s forwards; }
@keyframes nxHandTap {
    0%, 100% { transform: translateY(-50%) translate(0, 0) scale(1) rotate(-10deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    50% { transform: translateY(-50%) translate(-4px, -3px) scale(0.85) rotate(-5deg); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); }
}
nx-esim-modal .nx-esim-watch-video-btn { display: none; align-items: center; justify-content: center; width: 100%; padding: 13px 16px; margin-top: 10px; border-radius: 999px; background: #f0fdf4; color: #7C3AED; font-weight: 700; font-size: 15px; border: 1.5px solid rgba(124, 58, 237, 0.2); cursor: pointer; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.06); transition: all .15s ease; }
nx-esim-modal .nx-esim-watch-video-btn:hover { background: #e6f7ef; border-color: #7C3AED; transform: translateY(-1px); }
nx-esim-modal .nx-esim-watch-video-btn:active { transform: scale(0.98); }
.nx-video-modal-overlay { position: fixed; inset: 0; z-index: 999999999; display: none; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; }
.nx-video-modal-overlay.active { display: flex; }
.nx-video-sheet { background: #0c131d; border-radius: 24px; width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); display: flex; flex-direction: column; }
.nx-video-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(12, 19, 29, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.nx-video-title-wrap { display: flex; align-items: center; gap: 10px; }
.nx-video-icon { width: 32px; height: 32px; border-radius: 50%; background: rgba(124, 58, 237, 0.2); color: #A78BFA; display: flex; align-items: center; justify-content: center; }
.nx-video-title { font-size: 14px; font-weight: 700; color: #ffffff; margin: 0; }
.nx-video-subtitle { font-size: 11.5px; font-weight: 600; color: #A78BFA; margin: 2px 0 0; }
.nx-video-close-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); border: none; color: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color .15s; }
.nx-video-close-btn:hover { background: rgba(255, 255, 255, 0.25); }
.nx-video-player-container { background: #000; display: flex; align-items: center; justify-content: center; min-height: 240px; max-height: 72vh; }
.nx-video-element { width: 100%; max-height: 72vh; object-fit: contain; background: #000; }
@keyframes nxHandLifetime {
    0%, 85% { opacity: 1; visibility: visible; }
    100% { opacity: 0; visibility: hidden; }
}

nx-fav-popup { position: fixed; inset: 0; z-index: 999998; display: none; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); align-items: flex-end; justify-content: center; }
nx-fav-popup.active { display: flex; }
nx-fav-popup .nx-sheet { background: #fff; border-radius: 32px 32px 0 0; padding: 28px 20px 32px; width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto; }
nx-fav-popup .nx-sheet h3 { font-size: 20px; font-weight: 700; color: #7C3AED; margin: 0 0 4px; }
nx-fav-popup .nx-sheet > p { font-size: 13px; color: #64748b; margin: 0 0 20px; }
nx-fav-popup .nx-fav-row { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 10px; cursor: pointer; transition: border-color .15s; }
nx-fav-popup .nx-fav-row:hover { border-color: #7C3AED; }
nx-fav-popup .nx-fav-avatar { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; color: #7C3AED; flex-shrink: 0; }
nx-fav-popup .nx-fav-info { flex: 1; min-width: 0; }
nx-fav-popup .nx-fav-info strong { display: block; font-size: 15px; color: #7C3AED; }
nx-fav-popup .nx-fav-info span { font-size: 12px; color: #64748b; }
nx-fav-popup .nx-fav-rate { font-size: 13px; font-weight: 600; color: #7C3AED; }

nx-verify { position: fixed; inset: 0; z-index: 999999; display: none; background: #FFFFFF; flex-direction: column; overflow-y: auto; }
nx-verify.active { display: flex; }
nx-verify .nx-verify-inner { max-width: 440px; margin: 0 auto; width: 100%; padding: 0 16px 40px; }
nx-verify .nx-verify-card { background: linear-gradient(135deg, #7C3AED, #4C1D95); border-radius: 28px; padding: 32px 24px; text-align: center; color: #fff; margin: 16px 0; }
nx-verify .nx-verify-card .nx-wd-label { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; }
nx-verify .nx-verify-card h1 { font-size: 36px; font-weight: 700; margin: 8px 0; }
nx-verify .nx-verify-ready { font-size: 13px; color: rgba(255,255,255,0.6); margin: 0; }
nx-verify .nx-verify-box { background: #fff; border-radius: 24px; padding: 24px; }
nx-verify .nx-verify-box h3 { font-size: 18px; font-weight: 700; color: #7C3AED; margin: 0 0 8px; }
nx-verify .nx-verify-box > p { font-size: 13px; color: #64748b; margin: 0 0 16px; line-height: 1.5; }
nx-verify .nx-verify-box label { display: block; font-size: 13px; font-weight: 600; color: #7C3AED; margin-bottom: 8px; }
nx-verify input { width: 100%; padding: 14px; border-radius: 14px; border: 2px solid #e2e8f0; font-size: 15px; font-weight: 600; letter-spacing: 0.05em; color: #7C3AED; text-align: center; text-transform: uppercase; margin-bottom: 8px; background: #fff; }
nx-verify input:focus { outline: none; border-color: #7C3AED; }
nx-verify input.error { border-color: #ef4444; }
nx-verify .nx-verify-error { font-size: 12px; color: #ef4444; min-height: 16px; margin-bottom: 8px; }
nx-verify .nx-verify-help { display: flex; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
nx-verify .nx-verify-help-icon { color: #7C3AED; flex-shrink: 0; }
nx-verify .nx-verify-help-text h4 { font-size: 14px; font-weight: 600; color: #7C3AED; margin: 0 0 4px; }
nx-verify .nx-verify-help-text p { font-size: 12px; color: #64748b; margin: 0; line-height: 1.5; }

nx-withdraw { position: fixed; inset: 0; z-index: 999998; display: none; background: #FFFFFF; flex-direction: column; overflow-y: auto; }
nx-withdraw.active { display: flex; }
nx-withdraw .nx-wd-wrap { max-width: 440px; margin: 0 auto; width: 100%; padding: 16px; }
nx-withdraw .nx-wd-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 0 16px; }
nx-withdraw .nx-wd-header h2 { font-size: 20px; font-weight: 700; color: #7C3AED; }
nx-withdraw .nx-wd-back { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: none; color: #7C3AED; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
nx-withdraw .nx-wd-avatar { width: 40px; height: 40px; border-radius: 50%; background: #7C3AED; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
nx-withdraw .nx-wd-card { background: linear-gradient(135deg, #7C3AED, #4C1D95); border-radius: 28px; padding: 32px 24px; text-align: center; color: #fff; margin-bottom: 16px; }
nx-withdraw .nx-wd-label { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; }
nx-withdraw .nx-wd-balance { font-size: 38px; font-weight: 700; margin: 8px 0; }
nx-withdraw .nx-wd-min { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.6); }
nx-withdraw .nx-wd-status { background: #fff; border-radius: 20px; padding: 20px; margin-bottom: 16px; border: 1px solid rgba(16,97,70,0.08); }
nx-withdraw .nx-wd-status.locked { border-left: 4px solid #e07c2c; }
nx-withdraw .nx-wd-status.unlocked { border-left: 4px solid #2fbf71; }
nx-withdraw .nx-wd-status-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
nx-withdraw .nx-wd-status.locked .nx-wd-status-title { color: #d7771f; }
nx-withdraw .nx-wd-status.unlocked .nx-wd-status-title { color: #2fbf71; }
nx-withdraw .nx-wd-status p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }
nx-withdraw .nx-wd-progress { margin-bottom: 16px; }
nx-withdraw .nx-wd-progress-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
nx-withdraw .nx-wd-progress-top span { font-size: 13px; color: #64748b; }
nx-withdraw .nx-wd-progress-top strong { font-size: 14px; font-weight: 700; color: #7C3AED; }
nx-withdraw .nx-wd-bar { height: 10px; border-radius: 999px; overflow: hidden; background: #e8ece9; }
nx-withdraw .nx-wd-fill { width: 0%; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #c7e95a, #4C1D95); transition: width 1s ease; }
nx-withdraw .nx-wd-progress > p { font-size: 12px; color: #64748b; margin: 8px 0 0; }
nx-withdraw .nx-wd-btn { display: block; width: 100%; padding: 16px; border-radius: 999px; background: linear-gradient(135deg, #c7e95a, #a9d83a); color: #0f3327; font-weight: 700; font-size: 16px; border: none; cursor: pointer; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(169,216,58,0.25); }
nx-withdraw .nx-wd-btn:hover { transform: translateY(-1px); }
nx-withdraw .nx-wd-section { margin-top: 8px; }
nx-withdraw .nx-wd-section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: #7C3AED; margin-bottom: 12px; }
nx-withdraw .nx-wd-empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 24px; }
nx-withdraw .nx-wd-item { background: #fff; border-radius: 18px; padding: 16px; margin-bottom: 10px; border: 1px solid rgba(16,97,70,0.08); }
nx-withdraw .nx-wd-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
nx-withdraw .nx-wd-item-title { font-size: 15px; font-weight: 600; color: #7C3AED; }
nx-withdraw .nx-wd-badge { padding: 4px 10px; border-radius: 999px; background: #fff6d8; color: #c68a00; font-size: 11px; font-weight: 600; }
nx-withdraw .nx-wd-item-bottom { display: flex; justify-content: space-between; align-items: center; }
nx-withdraw .nx-wd-amount { font-size: 20px; font-weight: 700; color: #4C1D95; }
nx-withdraw .nx-wd-date { font-size: 12px; color: #94a3b8; }

nx-wd-locked { position: fixed; inset: 0; z-index: 999998; display: none; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); align-items: center; justify-content: center; padding: 20px; }
nx-wd-locked.active { display: flex; }

nx-keep-earning-modal { position: fixed; inset: 0; z-index: 999998; display: none; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); align-items: center; justify-content: center; padding: 20px; }
nx-keep-earning-modal.active { display: flex; }

@keyframes nx3dCelebrationPop {
    0%, 100% { transform: scale(1) rotate(-6deg); }
    50% { transform: scale(1.22) rotate(8deg); }
}

nx-success { position: fixed; inset: 0; z-index: 999999; display: none; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 24px; }
nx-success.active { display: flex; }
nx-success .nx-card { background: #fff; border-radius: 28px; padding: 40px 24px; max-width: 360px; width: 100%; text-align: center; }

nx-incoming-call { position: fixed; top: -340px; left: 50%; width: calc(100% - 24px); max-width: 420px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; border-radius: 28px; overflow: hidden; background: linear-gradient(150deg, #7C3AED 0%, #0d2824 100%); border: 1.5px solid rgba(255,255,255,0.22); box-shadow: 0 26px 65px rgba(0,0,0,0.45), 0 0 35px rgba(124, 58, 237, 0.18); z-index: 9999999; opacity: 0; transition: top 0.45s cubic-bezier(0.34,1.3,0.64,1), opacity 0.3s; }
nx-incoming-call.active { top: 20px; opacity: 1; }
nx-incoming-call .nx-ic-top-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; }
nx-incoming-call .nx-ic-top-left { display: flex; align-items: center; gap: 7px; }
nx-incoming-call .nx-ic-pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #A78BFA; box-shadow: 0 0 10px #A78BFA; animation: nxPulseDot 1.2s infinite; }
@keyframes nxPulseDot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } }
nx-incoming-call .nx-ic-badge-label { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 5px; }
nx-incoming-call .nx-ic-network-badge { font-size: 10.5px; font-weight: 600; color: #A78BFA; background: rgba(167, 139, 250, 0.15); padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(167, 139, 250, 0.25); }
nx-incoming-call .nx-ic-main { display: flex; align-items: center; gap: 14px; margin: 2px 0; }
nx-incoming-call .nx-ic-avatar-wrap { position: relative; flex-shrink: 0; }
nx-incoming-call .nx-ic-avatar { width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.14); border: 2.5px solid rgba(167, 139, 250, 0.6); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; position: relative; z-index: 2; }
nx-incoming-call .nx-ic-live-ripple { position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(167, 139, 250, 0.5); animation: nxRippleExpand 1.6s ease-out infinite; pointer-events: none; }
@keyframes nxRippleExpand { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.35); opacity: 0; } }
nx-incoming-call .nx-ic-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
nx-incoming-call .nx-ic-name-row { display: flex; align-items: center; gap: 6px; }
nx-incoming-call .nx-ic-name { font-size: 16px; font-weight: 700; color: #fff; line-height: 1.2; }
nx-incoming-call .nx-ic-verified-pill { font-size: 11px; font-weight: 600; color: #A78BFA; display: inline-flex; align-items: center; gap: 3px; }
nx-incoming-call .nx-ic-brand-text { font-size: 12.5px; color: rgba(255,255,255,0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
nx-incoming-call .nx-ic-reward-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
nx-incoming-call .nx-ic-reward-badge { font-size: 12px; font-weight: 700; color: #A78BFA; background: rgba(167, 139, 250, 0.16); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(167, 139, 250, 0.22); }
nx-incoming-call .nx-ic-actions { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
nx-incoming-call .nx-ic-decline { flex: 1; height: 46px; border-radius: 999px; border: 1px solid rgba(239,68,68,0.45); background: rgba(239,68,68,0.22); color: #fca5a5; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: background 0.15s, transform 0.15s; }
nx-incoming-call .nx-ic-decline:hover { background: rgba(239,68,68,0.36); }
nx-incoming-call .nx-ic-decline:active { transform: scale(0.97); }
nx-incoming-call .nx-ic-answer { flex: 1; height: 46px; border-radius: 999px; border: none; background: linear-gradient(135deg, #7C3AED, #7C3AED); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.42); transition: transform 0.15s, box-shadow 0.15s; }
nx-incoming-call .nx-ic-answer:hover { transform: scale(1.02); box-shadow: 0 6px 22px rgba(124, 58, 237, 0.52); }
nx-incoming-call .nx-ic-answer:active { transform: scale(0.97); }

/* Dynamic Notification Toasts (Live activity / withdrawal alerts) */
.nx-live-notification-toast { position: fixed; top: 20px; right: 20px; z-index: 999990; display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-radius: 18px; background: rgba(124, 58, 237, 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 16px 36px rgba(0,0,0,0.22), 0 0 20px rgba(124, 58, 237, 0.2); color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 360px; pointer-events: none; opacity: 0; transform: translateY(-20px) scale(0.95); transition: opacity 0.35s cubic-bezier(0.34, 1.2, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1); }
.nx-live-notification-toast.show { opacity: 1; transform: translateY(0) scale(1); }
.nx-live-notif-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(124, 58, 237, 0.2); color: #A78BFA; border: 1.5px solid rgba(124, 58, 237, 0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
.nx-live-notif-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.nx-live-notif-title { font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; }
.nx-live-notif-sub { font-size: 12px; color: rgba(255,255,255,0.78); line-height: 1.35; }
.nx-live-notif-badge { font-size: 11px; font-weight: 700; color: #A78BFA; background: rgba(124, 58, 237, 0.18); padding: 1px 6px; border-radius: 999px; }

nx-inactive-fab, .nx-inactive-fab { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; position: absolute !important; z-index: -9999 !important; }
nx-inactive-fab.show { display: none !important; }
nx-inactive-fab:active { display: none !important; }


nx-fab-popup { position: fixed; inset: 0; z-index: 999998; display: none; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); align-items: center; justify-content: center; padding: 20px; }
nx-fab-popup.active { display: flex; }
nx-fab-popup .nx-fab-card { background: #fff; border-radius: 28px; width: 100%; max-width: 360px; overflow: hidden; position: relative; animation: nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1); }
@keyframes nxFabPop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
nx-fab-popup .nx-fab-icon-wrap { width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 14px; background: rgba(255,77,109,0.08); border: 1px solid rgba(255,77,109,0.2); display: flex; align-items: center; justify-content: center; }
nx-fab-popup h3 { font-size: 20px; font-weight: 700; color: #7C3AED; margin: 0 0 8px; text-align: center; }
nx-fab-popup .nx-fab-desc { font-size: 14px; color: #64748b; line-height: 1.6; text-align: center; margin: 0 0 16px; }
nx-fab-popup .nx-fab-price { font-size: 28px; font-weight: 800; color: #7C3AED; text-align: center; }
nx-fab-popup .nx-fab-price-sub { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 4px; }
nx-fab-popup .nx-fab-actions { padding: 24px; display: flex; flex-direction: column; gap: 10px; }
nx-fab-popup .nx-fab-activate { display: block; text-align: center; padding: 15px; background: #7C3AED; color: #fff; border-radius: 14px; font-weight: 700; font-size: 15px; border: none; cursor: pointer; }
nx-fab-popup .nx-fab-dismiss { padding: 13px; background: transparent; border: 1px solid #e2e8f0; color: #64748b; border-radius: 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
nx-success .nx-icon { width: 80px; height: 80px; border-radius: 50%; background: #EDE9FE; color: #7C3AED; display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 0 auto 20px; }
nx-success h3 { font-size: 22px; font-weight: 700; color: #7C3AED; margin: 0 0 8px; }
nx-success p { font-size: 14px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
nx-success button { width: 100%; padding: 14px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 600; font-size: 15px; border: none; cursor: pointer; }

nx-threshold-modal { position: fixed; inset: 0; z-index: 999999; display: none; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); align-items: center; justify-content: center; padding: 20px; }
nx-threshold-modal.active { display: flex; }
nx-threshold-modal .nx-threshold-card { background: #fff; border-radius: 28px; padding: 32px 24px; max-width: 380px; width: 100%; text-align: center; position: relative; animation: nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
nx-threshold-modal .nx-threshold-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,77,109,0.1); color: #ff4d6d; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; }
nx-threshold-modal h3 { font-size: 20px; font-weight: 700; color: #7C3AED; margin: 0 0 10px; }
nx-threshold-modal p { font-size: 13.5px; color: #64748b; line-height: 1.55; margin: 0 0 20px; text-align: center; }
nx-threshold-modal .nx-threshold-balance-box { background: rgba(124, 58, 237, 0.05); border-radius: 16px; padding: 14px; margin-bottom: 20px; border: 1px solid rgba(124, 58, 237, 0.08); }
nx-threshold-modal .nx-threshold-balance-box span { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
nx-threshold-modal .nx-threshold-balance-box strong { font-size: 24px; font-weight: 700; color: #7C3AED; }
nx-threshold-modal .nx-threshold-btn { display: block; width: 100%; padding: 15px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 700; font-size: 15px; border: none; cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
nx-threshold-modal .nx-threshold-btn:hover { opacity: 0.95; transform: scale(1.01); }

nx-daily-cap-modal { position: fixed; inset: 0; z-index: 999999; display: none; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); align-items: center; justify-content: center; padding: 20px; }
nx-daily-cap-modal.active { display: flex; }
nx-daily-cap-modal .nx-threshold-card { background: #fff; border-radius: 28px; padding: 32px 24px; max-width: 380px; width: 100%; text-align: center; position: relative; animation: nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
nx-daily-cap-modal .nx-daily-cap-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(234,179,8,0.12); color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; }
nx-daily-cap-modal h3 { font-size: 20px; font-weight: 700; color: #7C3AED; margin: 0 0 10px; }
nx-daily-cap-modal p { font-size: 13.5px; color: #64748b; line-height: 1.55; margin: 0 0 20px; text-align: center; }
nx-daily-cap-modal .nx-threshold-balance-box { background: rgba(124, 58, 237, 0.05); border-radius: 16px; padding: 14px; margin-bottom: 20px; border: 1px solid rgba(124, 58, 237, 0.08); }
nx-daily-cap-modal .nx-threshold-balance-box span { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
nx-daily-cap-modal .nx-threshold-balance-box strong { font-size: 24px; font-weight: 700; color: #7C3AED; }
nx-daily-cap-modal .nx-threshold-btn { display: block; width: 100%; padding: 15px; border-radius: 999px; background: #7C3AED; color: #fff; font-weight: 700; font-size: 15px; border: none; cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
nx-daily-cap-modal .nx-threshold-btn:hover { opacity: 0.95; transform: scale(1.01); }

.nx-allocation-toast { position: fixed; top: -80px; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; align-items: center; gap: 10px; background: rgba(124, 58, 237, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); color: #fff; padding: 12px 22px; border-radius: 999px; box-shadow: 0 12px 36px rgba(0,0,0,0.25), 0 0 24px rgba(124, 58, 237, 0.35); border: 1px solid rgba(124, 58, 237, 0.35); transition: top 0.4s cubic-bezier(0.34,1.3,0.64,1), opacity 0.3s; opacity: 0; pointer-events: none; max-width: 90vw; }
.nx-allocation-toast.active { top: 24px; opacity: 1; }
.nx-alloc-icon { width: 28px; height: 28px; border-radius: 50%; background: rgba(124, 58, 237, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.nx-alloc-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,0.95); white-space: nowrap; }
.nx-alloc-text strong { color: #A78BFA; font-weight: 700; }
.nx-flying-coin { position: fixed; z-index: 999999; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #7C3AED, #4C1D95); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5); pointer-events: none; transition: transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.75s ease-in; opacity: 1; }
@keyframes nxBalancePulse { 0% { transform: scale(1); } 50% { transform: scale(1.08); color: #7C3AED; } 100% { transform: scale(1); } }
.nx-balance-pulse { animation: nxBalancePulse 0.6s ease; }

/* Admin Modal & Controls */
nx-admin-modal { position: fixed; inset: 0; z-index: 9999999; display: none; background: rgba(0,0,0,0.68); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; }
nx-admin-modal.active { display: flex; }
nx-admin-modal .nx-admin-card { background: #fff; border-radius: 28px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 28px 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.28); position: relative; animation: nxFabPop 0.3s cubic-bezier(0.34,1.2,0.64,1); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
nx-admin-modal .nx-admin-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; }
nx-admin-modal .nx-admin-header h3 { font-size: 20px; font-weight: 700; color: #7C3AED; margin: 0; display: flex; align-items: center; gap: 8px; }
nx-admin-modal .nx-admin-header p { font-size: 13px; color: #64748b; margin: 4px 0 0; }
nx-admin-modal .nx-admin-section-header { margin: 18px 0 10px; padding-top: 14px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
nx-admin-modal .nx-admin-section-header h4 { font-size: 13.5px; font-weight: 700; color: #7C3AED; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
nx-admin-modal .nx-admin-field { margin-bottom: 16px; }
nx-admin-modal .nx-admin-field label { display: block; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 6px; }
nx-admin-modal .nx-admin-field input, nx-admin-modal .nx-admin-field select { width: 100%; height: 44px; border-radius: 12px; border: 1.5px solid #e2e8f0; padding: 0 14px; font-size: 14px; color: #0f172a; outline: none; transition: border-color 0.2s, box-shadow 0.2s; background: #f8fafc; }
nx-admin-modal .nx-admin-field input:focus, nx-admin-modal .nx-admin-field select:focus { border-color: #7C3AED; background: #fff; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12); }
nx-admin-modal .nx-toggle-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; margin-bottom: 10px; }
nx-admin-modal .nx-toggle-box:hover { border-color: #cbd5e1; background: #f1f5f9; }
nx-admin-modal .nx-toggle-box input[type="checkbox"] { width: 18px; height: 18px; accent-color: #7C3AED; cursor: pointer; }
nx-admin-modal .nx-currency-toggle-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
nx-admin-modal .nx-curr-btn { padding: 12px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 13.5px; font-weight: 600; color: #475569; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; transition: all 0.2s; }
nx-admin-modal .nx-curr-btn.active { border-color: #7C3AED; background: rgba(124, 58, 237, 0.06); color: #7C3AED; font-weight: 700; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.1); }
nx-admin-modal .nx-admin-save-btn { width: 100%; height: 48px; border-radius: 14px; background: #7C3AED; color: #fff; font-size: 15px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s, transform 0.15s; margin-top: 14px; }
nx-admin-modal .nx-admin-save-btn:hover { opacity: 0.95; transform: scale(1.01); }
nx-admin-modal .nx-admin-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.nx-admin-floating-badge { position: fixed; bottom: 90px; right: 20px; z-index: 999980; background: #7C3AED; color: #fff; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2), 0 0 16px rgba(124, 58, 237, 0.3); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: 1.5px solid rgba(255,255,255,0.25); }
.nx-admin-floating-badge:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 28px rgba(0,0,0,0.25), 0 0 20px rgba(124, 58, 237, 0.4); }
@media (min-width: 1024px) {
    .nx-admin-floating-badge { bottom: 28px; right: 28px; }
}
    `;

    function injectCSS() {
        var s = el('style', '', CSS);
        document.head.appendChild(s);
        if (!document.getElementById('tv-styles')) {
            var tv = el('style', '', TV_CSS);
            tv.id = 'tv-styles';
            document.head.appendChild(tv);
        }
    }

    /* ====================================================================
     * UI BUILDERS
     * ==================================================================== */

    // --- Tasks Section (injected into dashboard) ---
    /* ====================================================================
     * TASKVEST — SURVEY + MUSIC TASKS (localStorage)
     * ==================================================================== */
    var TV_REWARD = 10000;
    var TV_DAILY_LIMIT = 5;

    var TV_CSS = `
    .tv-wrap { display:flex; flex-direction:column; gap:16px; }
    .tv-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .tv-title { font-family:inherit; font-size:18px; font-weight:800; color:#1a1a1a; }
    .tv-sub { font-size:12px; color:#8c8c8c; margin-top:3px; }
    .tv-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(124,58,237,0.10); color:#7C3AED; font-size:12px; font-weight:700; padding:7px 12px; border-radius:999px; white-space:nowrap; }
    .tv-group { display:flex; flex-direction:column; gap:10px; }
    .tv-group-head { display:flex; align-items:center; gap:8px; }
    .tv-group-ic { width:26px; height:26px; border-radius:999px; display:grid; place-items:center; color:#7C3AED; background:rgba(124,58,237,0.10); font-size:14px; }
    .tv-group-ic.music { background:rgba(167,139,250,0.20); }
    .tv-group-title { font-size:14px; font-weight:700; color:#1a1a1a; }
    .tv-group-count { font-size:11px; color:#8c8c8c; }
    .tv-group-line { flex:1; height:1px; background:linear-gradient(90deg, rgba(124,58,237,0.25), transparent); }
    .tv-list { display:flex; flex-direction:column; gap:10px; }
    .tv-card { display:flex; align-items:center; gap:12px; padding:14px; border-radius:18px; background:linear-gradient(135deg, rgba(124,58,237,0.07), rgba(167,139,250,0.03)); border:1px solid rgba(124,58,237,0.14); }
    .tv-card.done { opacity:0.72; }
    .tv-cover { width:46px; height:46px; border-radius:12px; flex-shrink:0; display:grid; place-items:center; overflow:hidden; background:linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow:0 8px 20px -8px rgba(139,92,246,0.5); color:#fff; font-size:22px; }
    .tv-cover img { width:100%; height:100%; object-fit:cover; display:block; }
    .tv-cover.sq { border-radius:16px; width:52px; height:52px; background:linear-gradient(135deg,#7C3AED,#6D28D9); box-shadow:0 10px 20px -6px rgba(124,58,237,0.32); font-size:24px; }
    .tv-info { flex:1; min-width:0; }
    .tv-info b { display:block; font-size:14px; font-weight:700; color:#1a1a1a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .tv-info span { display:block; font-size:12px; color:#8c8c8c; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .tv-reward { font-size:15px; font-weight:800; color:#7C3AED; margin-top:4px; }
    .tv-btn { flex-shrink:0; border:none; cursor:pointer; font-family:inherit; color:#fff; font-size:12.5px; font-weight:700; padding:9px 16px; border-radius:999px; background:linear-gradient(135deg,#8b5cf6,#7c3aed); transition:transform .15s, opacity .15s; }
    .tv-btn:hover { transform:scale(1.03); }
    .tv-btn:disabled { opacity:.6; cursor:default; }
    .tv-done { flex-shrink:0; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#7C3AED; background:rgba(124,58,237,0.10); padding:9px 12px; border-radius:999px; }

    .tv-mhead { display:flex; align-items:center; justify-content:space-between; }
    .tv-mclose { width:40px; height:40px; border-radius:999px; border:1px solid #e7e3f5; background:#fff; color:#1a1a1a; display:grid; place-items:center; cursor:pointer; font-size:20px; }
    .tv-mnet { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#8c8c8c; }
    .tv-art { position:relative; width:132px; height:132px; margin:28px auto 0; }
    .tv-art .glow { position:absolute; inset:-14px; border-radius:40px; background:rgba(124,58,237,0.20); filter:blur(26px); }
    .tv-art .cover { position:relative; width:100%; height:100%; border-radius:28px; overflow:hidden; display:grid; place-items:center; background:linear-gradient(135deg,#8b5cf6,#6d28d9); box-shadow:0 14px 34px -8px rgba(139,92,246,0.5); color:#fff; font-size:46px; }
    .tv-art .cover img { width:100%; height:100%; object-fit:cover; display:block; }
    .tv-song { text-align:center; font-size:21px; font-weight:800; color:#1a1a1a; margin-top:20px; }
    .tv-artist { text-align:center; font-size:13px; color:#8c8c8c; margin-top:4px; }
    .tv-prog { margin-top:22px; height:5px; border-radius:999px; background:rgba(124,58,237,0.15); overflow:hidden; }
    .tv-prog > i { display:block; height:100%; width:0%; border-radius:999px; background:linear-gradient(90deg,#8b5cf6,#ec4899); transition:width .2s linear; }
    .tv-time { margin-top:8px; display:flex; justify-content:space-between; font-size:11px; color:#8c8c8c; font-variant-numeric:tabular-nums; }
    .tv-play { margin:20px auto 0; width:60px; height:60px; border-radius:999px; border:none; cursor:pointer; color:#fff; display:grid; place-items:center; background:linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow:0 12px 26px -8px rgba(139,92,246,0.6); }
    .tv-play i { font-size:26px; }
    .tv-earnbox { margin-top:16px; border-radius:16px; border:1px solid #e7e3f5; background:#fff; padding:12px 16px; text-align:center; }
    .tv-earnbox span { font-size:12px; color:#8c8c8c; }
    .tv-earnbox strong { display:block; font-size:24px; font-weight:800; color:#7C3AED; }
    .tv-claim { margin-top:16px; width:100%; height:50px; border:none; border-radius:999px; cursor:pointer; color:#fff; font-family:inherit; font-size:14px; font-weight:700; background:linear-gradient(135deg,#8b5cf6,#7c3aed); }
    .tv-claim:disabled { opacity:.6; cursor:default; }

    .tv-svhead { display:flex; align-items:flex-start; gap:12px; }
    .tv-svic { width:44px; height:44px; border-radius:14px; flex-shrink:0; display:grid; place-items:center; color:#fff; font-size:22px; background:linear-gradient(135deg,#7C3AED,#6D28D9); box-shadow:0 8px 18px -6px rgba(124,58,237,0.4); }
    .tv-svlabel { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#8c8c8c; }
    .tv-svq { font-size:15px; font-weight:700; color:#1a1a1a; line-height:1.35; }
    .tv-opts { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
    .tv-opt { display:flex; align-items:center; gap:12px; width:100%; text-align:left; padding:12px; border-radius:14px; border:1px solid #e7e3f5; background:#fff; cursor:pointer; font-family:inherit; transition:border-color .15s, transform .15s; }
    .tv-opt:hover { border-color:#7C3AED; transform:translateY(-1px); }
    .tv-opt .key { width:28px; height:28px; border-radius:999px; flex-shrink:0; display:grid; place-items:center; font-size:12px; font-weight:700; color:#7C3AED; background:rgba(124,58,237,0.10); }
    .tv-opt .txt { flex:1; min-width:0; font-size:14px; color:#1a1a1a; }
    .tv-opt .go { color:#8c8c8c; }
    .tv-opt:hover .go { color:#7C3AED; }
    .tv-svfoot { margin-top:12px; text-align:center; font-size:11px; color:#8c8c8c; }
    .tv-donewrap { position:fixed; inset:0; z-index:10000; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(20,10,40,0.6); backdrop-filter:blur(6px); }
    .tv-donebox { width:100%; max-width:340px; background:#fff; border-radius:24px; padding:28px 22px; text-align:center; box-shadow:0 30px 70px rgba(0,0,0,0.35); }
    .tv-doneic { width:64px; height:64px; margin:0 auto; border-radius:999px; display:grid; place-items:center; color:#fff; font-size:30px; background:linear-gradient(135deg,#7C3AED,#6D28D9); box-shadow:0 12px 26px -8px rgba(124,58,237,0.6); }
    .tv-doneh { margin-top:14px; font-size:19px; font-weight:800; color:#1a1a1a; }
    .tv-donep { margin-top:6px; font-size:13px; color:#8c8c8c; line-height:1.4; }
    .tv-doneamt { margin-top:14px; font-size:32px; font-weight:800; color:#7C3AED; }
    .tv-donesub { font-size:12px; color:#8c8c8c; margin-top:2px; }
    .tv-donebtn { margin-top:18px; width:100%; height:48px; border:none; border-radius:999px; cursor:pointer; color:#fff; font-family:inherit; font-size:14px; font-weight:700; background:linear-gradient(135deg,#8b5cf6,#7c3aed); }
    .tv-svdots { display:flex; justify-content:center; gap:6px; margin-top:16px; }
    .tv-svdot { width:8px; height:8px; border-radius:999px; background:rgba(124,58,237,0.18); transition:background .2s, transform .2s; }
    .tv-svdot.on { background:#7C3AED; transform:scale(1.15); }
    `;

    var TV_KEY_BASE = 'nx_tv_tasks';
    function tvUserId() {
        try {
            var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
            return s.id || s.userId || s.email || '';
        } catch (_) { return ''; }
    }
    function tvKey() {
        var u = tvUserId();
        return u ? (TV_KEY_BASE + '_' + u) : TV_KEY_BASE;
    }

    var TV_SURVEYS = [
        { q: 'How often do you shop online?', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
        { q: 'Which device do you use most?', options: ['Android phone', 'iPhone', 'Laptop', 'Tablet'] },
        { q: 'What do you listen to most?', options: ['Afrobeats', 'Gospel', 'Hip-hop', 'Podcasts'] },
        { q: 'How do you usually pay online?', options: ['Bank transfer', 'Card', 'USSD', 'Wallet'] },
        { q: 'How many hours do you spend online daily?', options: ['1-2', '3-4', '5-6', '7+'] },
        { q: 'Which social app do you open first?', options: ['WhatsApp', 'Instagram', 'TikTok', 'X'] },
        { q: 'Do you read reviews before buying?', options: ['Always', 'Sometimes', 'Rarely', 'Never'] },
        { q: 'What matters most in a product?', options: ['Price', 'Quality', 'Brand', 'Delivery'] },
        { q: 'How do you discover new music?', options: ['Streaming apps', 'Radio', 'Friends', 'Social media'] },
        { q: 'Which best describes your work?', options: ['Student', 'Employed', 'Self-employed', 'Between jobs'] },
        { q: 'How often do you watch ads fully?', options: ['Always', 'Sometimes', 'Rarely', 'Never'] },
        { q: 'Preferred way to earn rewards?', options: ['Bank transfer', 'Airtime', 'Wallet', 'Voucher'] },
        { q: 'What time do you usually go online?', options: ['Morning', 'Afternoon', 'Evening', 'Late night'] },
        { q: 'Would you recommend TaskVest to a friend?', options: ['Definitely', 'Probably', 'Not sure', 'No'] }
    ];
    var TV_MUSIC = [
        { artist: 'Wizkid', song: 'Essence (feat. Tems)', term: 'wizkid essence tems' },
        { artist: 'Burna Boy', song: 'No Fit Vex', term: 'burna boy no fit vex' },
        { artist: 'Davido', song: 'B4 B4', term: 'davido b4 b4' },
        { artist: 'Asake', song: 'Gratitude', term: 'asake gratitude' },
        { artist: 'Oxlade', song: 'KU LO SA', term: 'oxlade ku lo sa' },
        { artist: 'Rema', song: 'Calm Down', term: 'rema calm down' },
        { artist: 'CKay', song: 'Love Nwantiti (Remix)', term: 'ckay love nwantiti' },
        { artist: 'Fireboy DML', song: 'Peru', term: 'fireboy dml peru' },
        { artist: 'Ayra Starr', song: 'Rush', term: 'ayra starr rush' },
        { artist: 'Libianca', song: 'People', term: 'libianca people' },
        { artist: 'Omah Lay', song: 'Soso', term: 'omah lay soso' },
        { artist: 'Tems', song: 'Free Mind', term: 'tems free mind' },
        { artist: 'Kizz Daniel', song: 'Buga (Lo Lo Lo)', term: 'kizz daniel buga' },
        { artist: 'Young Jonn', song: 'Dada', term: 'young jonn dada' },
        { artist: 'Victony', song: 'Soweto', term: 'victony soweto' },
        { artist: 'Shallipopi', song: 'Obapluto', term: 'shallipopi obapluto' },
        { artist: 'BNXN', song: 'GWAGWALADA', term: 'bnxn gwagwalada' },
        { artist: 'Ruger', song: 'Bounce', term: 'ruger bounce' },
        { artist: 'Joeboy', song: 'Alcohol', term: 'joeboy alcohol' }
    ];

    /* iTunes preview + artwork cache (like incossify/princess) */
    var TV_META_KEY = 'nx_tv_music_meta';
    function tvMetaCache() { try { return JSON.parse(localStorage.getItem(TV_META_KEY) || '{}'); } catch (_) { return {}; } }
    function tvMetaSave(m) { try { localStorage.setItem(TV_META_KEY, JSON.stringify(m)); } catch (_) {} }
    function tvFetchMeta(term) {
        return fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(term) + '&entity=song&limit=1')
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var r = j && j.results && j.results[0];
                return {
                    url: (r && r.previewUrl) || '',
                    art: (r && r.artworkUrl100) ? r.artworkUrl100.replace('/100x100bb.jpg', '/300x300bb.jpg') : ''
                };
            })
            .catch(function () { return { url: '', art: '' }; });
    }
    function tvPrefetchMusic(tasks) {
        var cache = tvMetaCache();
        tasks.filter(function (t) { return t.type === 'music'; }).forEach(function (t) {
            var term = t.music.term;
            if (cache[term] && (cache[term].url || cache[term].art)) return;
            tvFetchMeta(term).then(function (m) {
                if (m.url || m.art) {
                    var c = tvMetaCache(); c[term] = m; tvMetaSave(c); tvRender();
                }
            });
        });
    }

    function tvDay() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function tvState() {
        var st = null;
        try { st = JSON.parse(localStorage.getItem(tvKey()) || 'null'); } catch (_) {}
        if (!st || st.date !== tvDay() || !Array.isArray(st.done)) {
            st = { date: tvDay(), done: [] };
            localStorage.setItem(tvKey(), JSON.stringify(st));
        }
        return st;
    }
    function tvSave(st) { localStorage.setItem(tvKey(), JSON.stringify(st)); }
    function tvHash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

    function tvSurveySets() {
        var seed = tvHash(tvDay());
        var pool = TV_SURVEYS.slice();
        for (var i = pool.length - 1; i > 0; i--) {
            var j = (seed + i * 7) % (i + 1);
            var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }
        return [pool.slice(0, 5), pool.slice(5, 10)];
    }

    function tvDailyTasks() {
        var seed = tvHash(tvDay());
        var list = [];
        var sets = tvSurveySets();
        for (var i = 0; i < 2; i++) {
            list.push({ id: 'sv' + i, type: 'survey', title: 'Survey ' + (i + 1), reward: TV_REWARD, questions: sets[i], mins: 5 });
        }
        for (var j = 0; j < 3; j++) {
            var m = TV_MUSIC[(seed + j * 4) % TV_MUSIC.length];
            list.push({ id: 'mu' + j, type: 'music', title: m.song, subtitle: m.artist, reward: TV_REWARD, music: m, mins: 3 });
        }
        return list;
    }

    function tvCard(t, done) {
        if (t.type === 'music') {
            var meta = tvMetaCache()[t.music.term] || {};
            var cover = meta.art ? '<img src="' + meta.art + '" alt="">' : '<i class="ri-music-2-line"></i>';
            return '' +
                '<div class="tv-card' + (done ? ' done' : '') + '">' +
                    '<span class="tv-cover">' + cover + '</span>' +
                    '<div class="tv-info">' +
                        '<b>' + t.subtitle + '</b>' +
                        '<span>' + t.title + '</span>' +
                    '</div>' +
                    (done
                        ? '<span class="tv-done"><i class="ri-check-double-line"></i> Played</span>'
                        : '<button type="button" class="tv-btn" data-nx-tv-start="' + t.id + '">Play ' + money(t.reward) + '</button>') +
                '</div>';
        }
        return '' +
            '<div class="tv-card' + (done ? ' done' : '') + '">' +
                '<span class="tv-cover sq"><i class="ri-clipboard-line"></i></span>' +
                '<div class="tv-info">' +
                    '<b>' + t.title + '</b>' +
                    '<span>' + t.questions.length + ' questions · ' + t.mins + ' min</span>' +
                    '<div class="tv-reward">+' + money(t.reward) + '</div>' +
                '</div>' +
                (done
                    ? '<span class="tv-done"><i class="ri-check-double-line"></i> Done</span>'
                    : '<button type="button" class="tv-btn" data-nx-tv-start="' + t.id + '">Start</button>') +
            '</div>';
    }

    function tvRender() {
        var st = tvState();
        var tasks = tvDailyTasks();
        var surveys = tasks.filter(function (t) { return t.type === 'survey'; });
        var music = tasks.filter(function (t) { return t.type === 'music'; });
        var doneCount = tasks.filter(function (t) { return st.done.indexOf(t.id) !== -1; }).length;

        var prog = document.querySelector('[data-nx-tv-progress]');
        if (prog) prog.textContent = doneCount + '/' + TV_DAILY_LIMIT + ' done';

        var sBox = document.querySelector('[data-nx-tv-surveys]');
        if (sBox) sBox.innerHTML = surveys.map(function (t) { return tvCard(t, st.done.indexOf(t.id) !== -1); }).join('');
        var mBox = document.querySelector('[data-nx-tv-music]');
        if (mBox) mBox.innerHTML = music.map(function (t) { return tvCard(t, st.done.indexOf(t.id) !== -1); }).join('');
    }

    function tvFind(id) {
        var all = tvDailyTasks();
        for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
        return null;
    }

    function tvModal(html) {
        var m = document.getElementById('nx-tv-modal');
        if (!m) {
            m = el('div', '');
            m.id = 'nx-tv-modal';
            m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(20,10,40,0.55);backdrop-filter:blur(4px);';
            document.body.appendChild(m);
        }
        m.innerHTML = '<div style="background:#fff;border-radius:22px;width:100%;max-width:420px;padding:20px;box-shadow:0 30px 70px rgba(0,0,0,0.35);">' + html + '</div>';
        m.style.display = 'flex';
        return m;
    }
    function tvCloseModal() {
        var m = document.getElementById('nx-tv-modal');
        if (m) m.style.display = 'none';
        tvMusicEnded = true;
        if (tvMusicTimer) { clearInterval(tvMusicTimer); tvMusicTimer = null; }
        if (tvMusicDelay) { clearTimeout(tvMusicDelay); tvMusicDelay = null; }
        var a = document.getElementById('nx-tv-audio');
        if (a) { try { a.pause(); } catch (_) {} }
    }

    function tvOpen(id) {
        var t = tvFind(id); if (!t) return;
        var st = tvState();
        if (st.done.indexOf(id) !== -1) { toast('Task already completed today.'); return; }

        if (t.type === 'survey') {
            tvOpenSurvey(t);
        } else {
            tvOpenMusic(t);
        }
    }

    var tvSurvey = { id: null, idx: 0, total: 0, questions: [] };

    function tvOpenSurvey(t) {
        tvSurvey = { id: t.id, idx: 0, total: t.questions.length, questions: t.questions };
        tvSurveyRender();
    }

    function tvSurveyRender() {
        var t = tvFind(tvSurvey.id); if (!t) return;
        var q = tvSurvey.questions[tvSurvey.idx];
        var n = tvSurvey.total;
        var dots = tvSurvey.questions.map(function (_, i) {
            return '<span class="tv-svdot' + (i <= tvSurvey.idx ? ' on' : '') + '"></span>';
        }).join('');
        tvModal(
            '<div class="tv-svhead">' +
                '<span class="tv-svic"><i class="ri-clipboard-line"></i></span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div class="tv-svlabel">Survey · Question ' + (tvSurvey.idx + 1) + ' of ' + n + '</div>' +
                    '<div class="tv-svq">' + q.q + '</div>' +
                '</div>' +
                '<button type="button" class="tv-mclose" data-nx-tv-close><i class="ri-close-line"></i></button>' +
            '</div>' +
            '<div class="tv-opts">' +
                q.options.map(function (o, i) {
                    return '<button type="button" class="tv-opt" data-nx-tv-sanswer="' + i + '">' +
                        '<span class="key">' + String.fromCharCode(65 + i) + '</span>' +
                        '<span class="txt">' + o + '</span>' +
                        '<i class="ri-arrow-right-s-line go"></i>' +
                    '</button>';
                }).join('') +
            '</div>' +
            '<div class="tv-svdots">' + dots + '</div>'
        );
    }

    function tvSurveyAnswer() {
        tvSurvey.idx++;
        if (tvSurvey.idx >= tvSurvey.total) { tvComplete(tvSurvey.id); return; }
        tvSurveyRender();
    }

    function tvOpenMusic(t) {
        var cached = tvMetaCache()[t.music.term];
        if (cached && (cached.url || cached.art)) { tvMusicModal(t, cached); return; }
        tvModal('<div class="py-8 text-center"><i class="ri-loader-4-line animate-spin text-[28px] text-primary"></i><p class="font-sans text-muted text-[13px] mt-3">Loading track…</p></div>');
        tvFetchMeta(t.music.term).then(function (m) {
            var c = tvMetaCache(); c[t.music.term] = m; tvMetaSave(c);
            tvMusicModal(t, m);
        });
    }

    var tvMusicTimer = null, tvMusicDelay = null, tvMusicEnded = false;

    function tvMusicModal(t, meta) {
        var art = (meta && meta.art) || '';
        var url = (meta && meta.url) || '';
        tvMusicEnded = false;

        tvModal(
            '<div class="tv-mhead">' +
                '<button type="button" class="tv-mclose" data-nx-tv-close><i class="ri-close-line"></i></button>' +
                '<div class="tv-mnet"><i class="ri-line-chart-line" style="color:#7C3AED;"></i><span>TaskVest Music</span></div>' +
            '</div>' +
            '<div class="tv-art">' +
                '<span class="glow"></span>' +
                '<span class="cover">' + (art ? '<img src="' + art + '" alt="">' : '<i class="ri-music-2-line"></i>') + '</span>' +
            '</div>' +
            '<div class="tv-song">' + t.music.song + '</div>' +
            '<div class="tv-artist">' + t.music.artist + '</div>' +
            '<div class="tv-prog"><i id="nx-tv-mprog"></i></div>' +
            '<div class="tv-time"><span id="nx-tv-mcur">0:00</span><span id="nx-tv-mdur">0:00</span></div>' +
            '<button id="nx-tv-play" class="tv-play" type="button" aria-label="Play or pause"><i id="nx-tv-playicon" class="ri-play-fill"></i></button>' +
            '<div id="nx-tv-mearnbox" class="tv-earnbox" style="display:none;"><span>Earnings</span><strong id="nx-tv-mearn">' + money(0) + '</strong></div>' +
            '<button type="button" id="nx-tv-mdone" class="tv-claim" data-nx-tv-done="' + t.id + '" disabled>Listening…</button>' +
            '<audio id="nx-tv-audio" preload="auto" playsinline></audio>'
        );

        var audio = document.getElementById('nx-tv-audio');
        var playBtn = document.getElementById('nx-tv-play');
        var playIcon = document.getElementById('nx-tv-playicon');
        if (audio) {
            if (url) { audio.src = url; audio.load(); var p = audio.play(); if (p) p.catch(function () {}); }
            audio.addEventListener('timeupdate', function () {
                var cur = audio.currentTime || 0, dur = audio.duration || 0;
                var bar = document.getElementById('nx-tv-mprog');
                if (bar && dur) bar.style.width = (cur / dur * 100).toFixed(1) + '%';
                var c = document.getElementById('nx-tv-mcur'); if (c) c.textContent = tvFmtTime(cur);
                var d = document.getElementById('nx-tv-mdur'); if (d && dur) d.textContent = tvFmtTime(dur);
            });
            audio.addEventListener('ended', function () { if (playIcon) playIcon.className = 'ri-play-fill'; });
        }
        if (playBtn) playBtn.addEventListener('click', function () {
            if (!audio) return;
            if (audio.paused) { var pp = audio.play(); if (pp) pp.catch(function () {}); if (playIcon) playIcon.className = 'ri-pause-fill'; }
            else { audio.pause(); if (playIcon) playIcon.className = 'ri-play-fill'; }
        });

        if (tvMusicTimer) { clearInterval(tvMusicTimer); tvMusicTimer = null; }
        if (tvMusicDelay) { clearTimeout(tvMusicDelay); tvMusicDelay = null; }

        tvMusicDelay = setTimeout(function () {
            var box = document.getElementById('nx-tv-mearnbox');
            if (box) box.style.display = 'block';
            var MAX = t.reward, DURATION = 8000, start = Date.now();
            tvMusicTimer = setInterval(function () {
                if (tvMusicEnded) return;
                var prog = Math.min((Date.now() - start) / DURATION, 1);
                var e = document.getElementById('nx-tv-mearn');
                if (e) e.textContent = money(Math.floor(MAX * prog));
                if (prog >= 1) {
                    clearInterval(tvMusicTimer); tvMusicTimer = null;
                    var e2 = document.getElementById('nx-tv-mearn'); if (e2) e2.textContent = money(MAX);
                    var b = document.getElementById('nx-tv-mdone');
                    if (b) { b.disabled = false; b.textContent = 'Done · Claim ' + money(MAX); }
                    if (audio) { try { audio.pause(); } catch (_) {} }
                    if (playIcon) playIcon.className = 'ri-play-fill';
                }
            }, 50);
        }, 3500);
    }

    function tvFmtTime(s) {
        s = Math.floor(s || 0);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    var tvAllDonePending = false;

    function tvDoneModal(html) {
        var m = document.getElementById('nx-tv-done');
        if (!m) {
            m = el('div', 'tv-donewrap');
            m.id = 'nx-tv-done';
            document.body.appendChild(m);
        }
        m.innerHTML = '<div class="tv-donebox">' + html + '</div>';
        m.style.display = 'flex';
    }
    function tvCloseDone() {
        var m = document.getElementById('nx-tv-done');
        if (m) m.style.display = 'none';
    }
    function tvAllDone() {
        var st = tvState();
        return tvDailyTasks().every(function (t) { return st.done.indexOf(t.id) !== -1; });
    }
    function tvShowComplete(t) {
        tvDoneModal(
            '<div class="tv-doneic"><i class="ri-check-line"></i></div>' +
            '<h3 class="tv-doneh">Task complete!</h3>' +
            '<p class="tv-donep">' + (t.type === 'music' ? 'Music task' : 'Survey') + ' finished successfully.</p>' +
            '<div class="tv-doneamt">+' + money(t.reward) + '</div>' +
            '<div class="tv-donesub">Added to your balance</div>' +
            '<button type="button" class="tv-donebtn" data-nx-tv-cdone>Done</button>'
        );
    }
    function tvShowAllDone() {
        tvDoneModal(
            '<div class="tv-doneic"><i class="ri-trophy-line"></i></div>' +
            '<h3 class="tv-doneh">All tasks completed for today!</h3>' +
            '<p class="tv-donep">You finished all ' + TV_DAILY_LIMIT + ' tasks. Come back tomorrow for fresh surveys and music.</p>' +
            '<button type="button" class="tv-donebtn" data-nx-tv-cdone>OK</button>'
        );
    }

    function tvComplete(id) {
        var t = tvFind(id); if (!t) return;
        var st = tvState();
        if (st.done.indexOf(id) !== -1) { tvCloseModal(); return; }
        if (st.done.length >= TV_DAILY_LIMIT) { toast('Daily task limit reached. Come back tomorrow.'); tvCloseModal(); return; }
        st.done.push(id); tvSave(st);
        addEarnings(t.reward, (t.type === 'music' ? 'Music task reward' : 'Survey task reward'), t.type);
        tvCloseModal();
        tvRender();
        tvAllDonePending = tvAllDone();
        tvShowComplete(t);
    }

    var tvWired = false;
    function tvWire() {
        if (tvWired) return;
        tvWired = true;
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var start = t.closest('[data-nx-tv-start]');
            if (start) { tvOpen(start.getAttribute('data-nx-tv-start')); return; }
            if (t.closest('[data-nx-tv-close]')) { tvCloseModal(); return; }
            if (t.closest('[data-nx-tv-cdone]') || t.id === 'nx-tv-done') {
                tvCloseDone();
                if (tvAllDonePending) { tvAllDonePending = false; tvShowAllDone(); }
                return;
            }
            var ans = t.closest('[data-nx-tv-answer]');
            if (ans) { tvComplete(ans.getAttribute('data-nx-tv-answer')); return; }
            var sans = t.closest('[data-nx-tv-sanswer]');
            if (sans) { tvSurveyAnswer(); return; }
            var done = t.closest('[data-nx-tv-done]');
            if (done) { tvComplete(done.getAttribute('data-nx-tv-done')); return; }
            if (t.id === 'nx-tv-modal') { tvCloseModal(); return; }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') tvCloseModal();
        });
    }

    function tvGroupHead(icon, label, count, music) {
        return '' +
            '<div class="tv-group-head">' +
                '<span class="tv-group-ic' + (music ? ' music' : '') + '"><i class="' + icon + '"></i></span>' +
                '<span class="tv-group-title">' + label + '</span>' +
                '<span class="tv-group-count">' + count + ' tasks</span>' +
                '<span class="tv-group-line"></span>' +
            '</div>';
    }

    function buildTasksSection() {
        var section = el('div', 'tv-wrap');
        section.setAttribute('data-nx-tasks', '');
        section.innerHTML =
            '<div class="tv-head">' +
                '<div>' +
                    '<div class="tv-title">Daily Tasks</div>' +
                    '<div class="tv-sub">Complete surveys and listen to music · up to ' + money(TV_REWARD) + ' each</div>' +
                '</div>' +
                '<span class="tv-pill"><i class="ri-flashlight-fill"></i><span data-nx-tv-progress>0/' + TV_DAILY_LIMIT + ' done</span></span>' +
            '</div>' +
            '<div class="tv-group">' +
                tvGroupHead('ri-clipboard-line', 'Surveys', 2, false) +
                '<div class="tv-list" data-nx-tv-surveys></div>' +
            '</div>' +
            '<div class="tv-group">' +
                tvGroupHead('ri-music-2-line', 'Music Listening', 3, true) +
                '<div class="tv-list" data-nx-tv-music></div>' +
            '</div>';
        tvWire();
        setTimeout(tvRender, 0);
        setTimeout(function () { tvPrefetchMusic(tvDailyTasks()); }, 50);
        return section;
    }

    function isThresholdReached() {
        if (isReachMinBeforeWithdrawEnabled()) {
            return false;
        }
        return !isActive() && earnings() >= CONST.MAX_UNACTIVATED_EARNINGS;
    }

    function animateFlyToBalance(amount) {
        // 1. Toast / Allocation Pill
        var pill = el('div', 'nx-allocation-toast');
        pill.innerHTML = `
            <div class="nx-alloc-icon">
                <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><circle cx="12" cy="12" r="10" stroke="#7C3AED" stroke-width="2"/><path d="M12 6v12M15 9.5H9a2.5 2.5 0 0 0 0 5h6" stroke="#7C3AED" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="nx-alloc-text">
                <span>Ad partner allocation added to balance: <strong>` + money(amount) + `</strong></span>
            </div>
        `;
        document.body.appendChild(pill);
        setTimeout(function () { pill.classList.add('active'); }, 20);

        // 2. Flying particles from center towards top-left / balance area
        var target = document.querySelector('[data-balance-display]') || document.querySelector('.font-heading.font-semibold.text-text.leading-none') || document.querySelector('[x-text*="balances[i].amount"]');
        var targetRect = target ? target.getBoundingClientRect() : { left: 40, top: 120 };
        var startX = window.innerWidth / 2;
        var startY = window.innerHeight / 2 + 40;
        var endX = (targetRect.left && targetRect.left > 0) ? (targetRect.left + 40) : (window.innerWidth * 0.25);
        var endY = (targetRect.top && targetRect.top > 0) ? (targetRect.top + 20) : 140;

        for (var i = 0; i < 5; i++) {
            (function (idx) {
                setTimeout(function () {
                    var p = el('div', 'nx-flying-coin');
                    p.innerHTML = getActiveCurrency() === 'USD' ? '$' : '₦';
                    p.style.left = startX + 'px';
                    p.style.top = startY + 'px';
                    document.body.appendChild(p);
                    requestAnimationFrame(function () {
                        p.style.transform = 'translate(' + (endX - startX + (idx * 8 - 16)) + 'px, ' + (endY - startY + (idx * 5 - 10)) + 'px) scale(0.6)';
                        p.style.opacity = '0';
                    });
                    setTimeout(function () {
                        p.remove();
                        if (idx === 4 && target) {
                            target.classList.add('nx-balance-pulse');
                            setTimeout(function () { target.classList.remove('nx-balance-pulse'); }, 600);
                        }
                    }, 750);
                }, idx * 60);
            })(i);
        }

        setTimeout(function () {
            pill.classList.remove('active');
            setTimeout(function () { pill.remove(); }, 400);
        }, 3500);
    }

    function renderPhonebook() {
        var box = $('[data-nx-phonebook]');
        if (!box) return;
        var d = callData();
        // Sort so contacts with used < 2 are first, and used >= 2 go down to the bottom
        var sorted = PHONEBOOK.slice().sort(function (a, b) {
            var usedA = ((d.counts[a.id] != null ? d.counts[a.id] : d.counts[a.name]) || 0) >= CONST.CALL_DAILY_LIMIT ? 1 : 0;
            var usedB = ((d.counts[b.id] != null ? d.counts[b.id] : d.counts[b.name]) || 0) >= CONST.CALL_DAILY_LIMIT ? 1 : 0;
            return usedA - usedB;
        });

        box.innerHTML = sorted.map(function (c) {
            var used = (d.counts[c.id] != null ? d.counts[c.id] : d.counts[c.name]) || 0;
            var completed = used >= CONST.CALL_DAILY_LIMIT;
            return '' +
                '<div class="flex items-center gap-3 p-3 rounded-[16px] bg-surface border border-black/[0.03]">' +
                    '<span class="size-[44px] rounded-full bg-primary/10 text-primary flex items-center justify-center font-heading font-semibold text-[16px] shrink-0">' + c.name[0] + '</span>' +
                    '<div class="flex-1 min-w-0">' +
                        '<p class="font-heading font-medium text-text text-[14px]">' + c.name + ' <span class="text-[12px] text-primary font-semibold">(' + c.brand + ')</span></p>' +
                        '<p class="font-sans text-muted text-[12px]">from ' + c.brand + ' · ' + c.phone + '</p>' +
                        '<p class="font-sans text-[11px] mt-0.5" style="color:' + (completed ? '#ff4d6d' : '#7C3AED') + ';">' +
                            (completed ? '2/2 calls today · activate to earn more from advertiser' : used + '/2 calls today') +
                        '</p>' +
                    '</div>' +
                    '<button type="button" data-nx-call="' + c.id + '" ' +
                        'class="flex items-center gap-2 shrink-0 rounded-full px-4 h-[38px] bg-primary text-white font-sans text-[13px] font-semibold hover:opacity-90 transition cursor-pointer">' +
                        '<svg viewBox="0 0 24 24" fill="none" class="w-4 h-4"><path d="M22 16.92V20a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 11.2 18.8A19.5 19.5 0 0 1 5.2 12.8A19.8 19.8 0 0 1 2 4.18A2 2 0 0 1 4 2h3.09a2 2 0 0 1 2 1.72l.46 3a2 2 0 0 1-.57 1.72L7.8 9.62a16 16 0 0 0 6.58 6.58l1.18-1.18a2 2 0 0 1 1.72-.57l3 .46A2 2 0 0 1 22 16.92Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>' +
                        '<span>Call</span>' +
                    '</button>' +
                '</div>';
        }).join('');
    }

    function renderFavStrip() {
        var strip = $('[data-nx-fav-strip]');
        if (!strip) return;
        var favs = favorites();
        var html = favs.map(function (f) {
            return '<div class="flex flex-col items-center gap-1 shrink-0 w-[52px]">' +
                '<span class="size-[44px] rounded-full bg-primary/10 text-primary flex items-center justify-center font-heading font-semibold text-[16px]">' + f.name[0] + '</span>' +
                '<span class="font-sans text-muted text-[11px] truncate w-full text-center">' + f.name + '</span>' +
            '</div>';
        }).join('');
        // Always append the "+ Add" tile
        html += '<button type="button" data-nx-add-fav class="flex flex-col items-center gap-1 shrink-0 w-[52px]">' +
            '<span class="size-[44px] rounded-full border border-dashed border-muted/40 flex items-center justify-center text-muted hover:text-primary hover:border-primary transition">' +
                '<svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
            '</span>' +
            '<span class="font-sans text-muted text-[11px]">Add</span>' +
        '</button>';
        strip.innerHTML = html;
        strip.style.display = 'flex';
        strip.style.flexWrap = 'nowrap';
        strip.style.overflowX = 'auto';
        strip.style.scrollBehavior = 'smooth';
        strip.style.gap = '12px';

        // Update the limit counter
        var lim = favLimit();
        var limText = $('[data-nx-fav-limit-text]');
        if (limText) {
            var left = CONST.FAV_LIMIT - lim.count;
            limText.textContent = lim.count + '/' + CONST.FAV_LIMIT + ' saves today · resets in 24h';
            limText.style.color = left === 0 ? '#ff4d6d' : '';
        }
    }

    function renderHistory() {
        var box = $('[data-nx-history]');
        if (!box) return;
        var d = callData();
        if (!d.history.length) {
            box.innerHTML = '<p class="font-sans text-muted text-[13px] py-3 text-center">No completed calls yet.</p>';
            return;
        }
        box.innerHTML = d.history.map(function (h) {
            return '' +
                '<div class="flex items-center gap-3 py-2">' +
                    '<span class="size-[36px] rounded-full bg-success/15 text-success flex items-center justify-center font-heading font-semibold text-[14px]">' + (h.name[0] || '?') + '</span>' +
                    '<div class="flex-1 min-w-0">' +
                        '<p class="font-sans font-medium text-text text-[13px]">' + h.name + ' · Sponsored Call</p>' +
                        '<p class="font-sans text-muted text-[11px]">Completed · ' + h.time + '</p>' +
                    '</div>' +
                    '<span class="font-heading font-semibold text-success text-[14px]">+' + money(h.amount) + '</span>' +
                '</div>';
        }).join('');
    }

    function refreshAll() {
        renderPhonebook();
        renderFavStrip();
        renderHistory();
        updatePlanBadge();
        updateQuickTasksVisibility();
        updateFabVisibility();
        if (window.NexAuth) {
            if (typeof NexAuth.renderBalances === 'function') NexAuth.renderBalances();
            if (typeof NexAuth.renderTransactions === 'function') NexAuth.renderTransactions();
        }
    }

    function updatePlanBadge() {
        var badges = $all('[data-nx-plan-badge]');
        var sidebarCaps = $all('.block.font-sans.text-white\\/55');
        if (isActive() || isReachMinBeforeWithdrawEnabled()) {
            badges.forEach(function (badge) {
                badge.style.background = 'rgba(124, 58, 237, 0.1)';
                badge.style.color = '#7C3AED';
                badge.style.cursor = 'default';
                badge.removeAttribute('data-nx-open-esim');
                badge.removeAttribute('title');
                badge.innerHTML = '<span class="size-1.5 rounded-full" style="background:#7C3AED;"></span>' + (isActive() ? 'Activated account' : 'Active Member');
            });
            sidebarCaps.forEach(function (el) {
                if (/Account Inactive|Royal eSIM/i.test(el.textContent)) el.textContent = isActive() ? 'Activated account' : 'Active Member';
                el.style.cursor = 'default';
                el.removeAttribute('data-nx-open-esim');
            });
        } else {
            badges.forEach(function (badge) {
                badge.style.background = 'rgba(255,77,109,0.1)';
                badge.style.color = '#ff4d6d';
                badge.style.cursor = 'pointer';
                badge.setAttribute('data-nx-open-esim', '');
                badge.title = 'Click to activate account';
                badge.innerHTML = '<span class="size-1.5 rounded-full" style="background:#ff4d6d;"></span>Account Inactive';
            });
            sidebarCaps.forEach(function (el) {
                if (/Activated account|Royal eSIM/i.test(el.textContent)) el.textContent = 'Account Inactive';
                el.style.cursor = 'pointer';
                el.setAttribute('data-nx-open-esim', '');
            });
        }
    }

    /* ====================================================================
     * ACTIVATION GATE & THRESHOLD MODAL
     * ==================================================================== */
    function buildGate() {
        var gate = el('nx-gate', '');
        gate.innerHTML = `
            <div class="nx-gate-card">
                <button type="button" class="nx-modal-x" data-nx-gate-close>
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div class="nx-gate-icon"><i class="ri-lock-line"></i></div>
                <h3>Activate your account</h3>
                <p>Choose a package to activate your account so you can withdraw your earnings and unlock more tasks.</p>
                <button type="button" class="nx-gate-btn" data-nx-gate-activate>Activate Now</button>
            </div>
        `;
        return gate;
    }

    function showGate() {
        if (isReachMinBeforeWithdrawEnabled()) {
            checkAndShowCapOrKeepEarning();
            return;
        }
        if (isActive()) {
            toast('Navigate to the sponsored calls section to start your tasks');
            var pb = $('[data-nx-phonebook]');
            if (pb) pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        var g = $('nx-gate');
        if (g) g.classList.add('active');
    }
    function hideGate() {
        var g = $('nx-gate');
        if (g) g.classList.remove('active');
    }

    /* ====================================================================
     * WELCOME / SIGNUP BONUS MODAL
     * ==================================================================== */
    function welcomeBonusAmount() {
        if (NEXTEL_CONFIG && NEXTEL_CONFIG.welcomeBalance != null) return Number(NEXTEL_CONFIG.welcomeBalance) || 0;
        return CONST.SIGNUP_BONUS || 200000;
    }
    function buildWelcomeModal() {
        var m = el('nx-welcome', '');
        var amt = welcomeBonusAmount();
        m.innerHTML = `
            <div class="nx-welcome-card">
                <button type="button" class="nx-modal-x" data-nx-welcome-close>
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div class="nx-welcome-ic">&#127881;</div>
                <h3>Welcome to TaskVest!</h3>
                <p>Your account is ready. We've credited your welcome bonus to your balance.</p>
                <div class="nx-welcome-amt">${money(amt)}</div>
                <button type="button" class="nx-welcome-btn" data-nx-welcome-close>Start Earning</button>
            </div>
        `;
        return m;
    }
    function showWelcomeModal() {
        var m = $('nx-welcome');
        if (!m) {
            document.body.appendChild(buildWelcomeModal());
            m = $('nx-welcome');
        }
        m.classList.add('active');
    }
    function hideWelcomeModal() {
        var m = $('nx-welcome');
        if (m) m.classList.remove('active');
    }
    function maybeShowWelcome() {
        try {
            if (localStorage.getItem('nx_show_welcome') !== '1') return;
            localStorage.removeItem('nx_show_welcome');
        } catch (e) { return; }
        setTimeout(showWelcomeModal, 600);
    }

    /* ====================================================================
     * BUY AIRTIME MODAL
     * ==================================================================== */
    function buildAirtimeModal() {
        var m = el('nx-airtime-modal', '');
        m.innerHTML = `
            <div class="nx-airtime-card" style="background:#ffffff;border-radius:24px;width:100%;max-width:380px;position:relative;box-shadow:0 24px 60px rgba(0,0,0,0.3);overflow:hidden;animation:nxFabPop 0.35s cubic-bezier(0.34,1.3,0.64,1);padding:24px 20px;font-family:system-ui,-apple-system,sans-serif;">
                <button type="button" class="nx-modal-x" data-nx-airtime-close style="position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div style="width:52px;height:52px;border-radius:16px;background:rgba(124, 58, 237, 0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#7C3AED;">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                </div>
                <h3 style="font-size:19px;font-weight:700;color:#7C3AED;margin:0 0 4px;text-align:center;">Instant Airtime Recharge</h3>
                <p style="font-size:12px;color:#64748b;margin:0 0 16px;text-align:center;">Top up your line instantly with TaskVest telecom network partners.</p>

                <!-- Network Picker -->
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Select Network</label>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="nxNetworkSelector">
                        <button type="button" class="nx-net-opt active" data-network="MTN" style="padding:8px 4px;border-radius:10px;border:1.5px solid #7C3AED;background:#F1EEFB;font-weight:700;font-size:12px;color:#7C3AED;cursor:pointer;text-align:center;">MTN</button>
                        <button type="button" class="nx-net-opt" data-network="Airtel" style="padding:8px 4px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:600;font-size:12px;color:#475569;cursor:pointer;text-align:center;">Airtel</button>
                        <button type="button" class="nx-net-opt" data-network="Glo" style="padding:8px 4px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:600;font-size:12px;color:#475569;cursor:pointer;text-align:center;">Glo</button>
                        <button type="button" class="nx-net-opt" data-network="9mobile" style="padding:8px 4px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:600;font-size:12px;color:#475569;cursor:pointer;text-align:center;">9mobile</button>
                    </div>
                </div>

                <!-- Phone Input -->
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Phone Number</label>
                    <input type="tel" id="nxAirtimePhone" placeholder="08012345678" style="width:100%;padding:10px 14px;border-radius:12px;border:1.5px solid #cbd5e1;font-size:14px;outline:none;background:#f8fafc;box-sizing:border-box;color:#0f172a;font-weight:600;">
                </div>

                <!-- Amount Chips -->
                <div style="margin-bottom:16px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Recharge Amount</label>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
                        <button type="button" class="nx-airtime-amt" data-amt="500" style="padding:8px 2px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:700;font-size:12px;color:#7C3AED;cursor:pointer;">₦500</button>
                        <button type="button" class="nx-airtime-amt active" data-amt="1000" style="padding:8px 2px;border-radius:10px;border:1.5px solid #7C3AED;background:#F1EEFB;font-weight:700;font-size:12px;color:#7C3AED;cursor:pointer;">₦1,000</button>
                        <button type="button" class="nx-airtime-amt" data-amt="2000" style="padding:8px 2px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:700;font-size:12px;color:#7C3AED;cursor:pointer;">₦2,000</button>
                        <button type="button" class="nx-airtime-amt" data-amt="5000" style="padding:8px 2px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-weight:700;font-size:12px;color:#7C3AED;cursor:pointer;">₦5,000</button>
                    </div>
                    <input type="number" id="nxAirtimeCustom" value="1000" placeholder="Custom amount" style="width:100%;padding:10px 14px;border-radius:12px;border:1.5px solid #cbd5e1;font-size:14px;outline:none;background:#f8fafc;box-sizing:border-box;color:#0f172a;font-weight:700;">
                </div>

                <!-- Submit Button -->
                <button type="button" id="nxSubmitAirtimeBtn" style="width:100%;padding:13px;border-radius:999px;background:#7C3AED;color:#ffffff;font-weight:700;font-size:14px;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(124, 58, 237, 0.25);">
                    Pay & Recharge Airtime
                </button>
            </div>
        `;

        // Interactive logic for airtime modal
        m.addEventListener('click', function(e) {
            var netBtn = e.target.closest('.nx-net-opt');
            if (netBtn) {
                m.querySelectorAll('.nx-net-opt').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.borderColor = '#e2e8f0';
                    b.style.background = '#ffffff';
                    b.style.color = '#475569';
                });
                netBtn.classList.add('active');
                netBtn.style.borderColor = '#7C3AED';
                netBtn.style.background = '#F1EEFB';
                netBtn.style.color = '#7C3AED';
            }

            var amtBtn = e.target.closest('.nx-airtime-amt');
            if (amtBtn) {
                m.querySelectorAll('.nx-airtime-amt').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.borderColor = '#e2e8f0';
                    b.style.background = '#ffffff';
                });
                amtBtn.classList.add('active');
                amtBtn.style.borderColor = '#7C3AED';
                amtBtn.style.background = '#F1EEFB';
                var customInp = m.querySelector('#nxAirtimeCustom');
                if (customInp) customInp.value = amtBtn.getAttribute('data-amt');
            }

            var submitBtn = e.target.closest('#nxSubmitAirtimeBtn');
            if (submitBtn) {
                var phone = (m.querySelector('#nxAirtimePhone') || {}).value || '';
                var amount = Number((m.querySelector('#nxAirtimeCustom') || {}).value) || 1000;
                var net = (m.querySelector('.nx-net-opt.active') || {}).textContent || 'MTN';

                submitBtn.textContent = 'Processing Recharge...';
                submitBtn.disabled = true;
                setTimeout(function() {
                    submitBtn.textContent = 'Pay & Recharge Airtime';
                    submitBtn.disabled = false;
                    hideAirtimeModal();
                    toast('Airtime recharge of ₦' + amount.toLocaleString() + ' to ' + (phone || 'your line') + ' (' + net + ') was successful!', true);
                }, 1000);
            }

            var closeBtn = e.target.closest('[data-nx-airtime-close]');
            if (closeBtn || e.target === m) {
                hideAirtimeModal();
            }
        });

        return m;
    }

    function showAirtimeModal() {
        var m = $('nx-airtime-modal');
        if (!m) {
            document.body.appendChild(buildAirtimeModal());
            m = $('nx-airtime-modal');
        }
        var session = (window.NexAuth && NexAuth.session()) || {};
        var phoneInp = m.querySelector('#nxAirtimePhone');
        if (phoneInp && session.phoneNumber) {
            phoneInp.value = session.phoneNumber;
        }
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideAirtimeModal() {
        var m = $('nx-airtime-modal');
        if (m) m.classList.remove('active');
        document.body.style.overflow = '';
    }

    function buildThresholdModal() {
        var m = el('nx-threshold-modal', '');
        m.innerHTML = `
            <div class="nx-threshold-card">
                <button type="button" class="nx-modal-x" data-nx-threshold-close style="position:absolute;top:14px;right:14px;">
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div class="nx-threshold-icon">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none"><path d="M12 9v4M12 17h.01" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="10" stroke="#ff4d6d" stroke-width="2"/></svg>
                </div>
                <h3>Maximum Earnings Reached</h3>
                <p>You've reached the maximum earnings an inactivated TaskVest account can earn, you need to activate your account to carry on with earnings and start withdrawing your already made Earnings from your call time with our ads partners.</p>
                <div class="nx-threshold-balance-box">
                    <span>Current Balance</span>
                    <strong data-nx-threshold-balance>${money(CONST.MAX_UNACTIVATED_EARNINGS)}</strong>
                </div>
                <button type="button" class="nx-threshold-btn" data-nx-threshold-activate>Activate Account</button>
            </div>
        `;
        return m;
    }

    function showThresholdModal() {
        if (isReachMinBeforeWithdrawEnabled()) {
            checkAndShowCapOrKeepEarning();
            return;
        }
        var m = $('nx-threshold-modal');
        if (!m) {
            document.body.appendChild(buildThresholdModal());
            m = $('nx-threshold-modal');
        }
        var bal = $('[data-nx-threshold-balance]', m);
        if (bal) bal.textContent = money(earnings());
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideThresholdModal() {
        var m = $('nx-threshold-modal');
        if (m) m.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ====================================================================
     * DAILY EARNINGS CAP MODAL
     * ==================================================================== */
    function buildDailyCapModal(todayEarned, capAmount) {
        var m = el('nx-daily-cap-modal', '');
        var earned = todayEarned != null ? Number(todayEarned) : cachedTodayEarned;
        var cap = capAmount != null ? Number(capAmount) : getDailyEarnCapAmount();
        m.innerHTML = `
            <div class="nx-threshold-card">
                <button type="button" class="nx-modal-x" data-nx-daily-cap-close style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#64748b;">
                    <svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px;"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div class="nx-daily-cap-icon">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <h3>Maximum Earnings Reached</h3>
                <div class="nx-daily-cap-subhead" style="margin:4px 0 14px;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <span style="font-weight:800;font-size:16px;color:#0f3327;display:inline-flex;align-items:center;gap:8px;letter-spacing:-0.2px;">
                        Come back Tomorrow
                        <span class="nx-3d-celebration-anim" style="display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;animation:nx3dCelebrationPop 2s ease-in-out infinite;">
                            <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style="filter:drop-shadow(0 4px 8px rgba(124, 58, 237, 0.3));">
                                <defs>
                                    <linearGradient id="c3dGold" x1="0%" y1="100%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#d97706"/>
                                        <stop offset="40%" stop-color="#f59e0b"/>
                                        <stop offset="80%" stop-color="#fbbf24"/>
                                        <stop offset="100%" stop-color="#fef3c7"/>
                                    </linearGradient>
                                    <linearGradient id="c3dCone" x1="0%" y1="100%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#5B21B6"/>
                                        <stop offset="50%" stop-color="#7C3AED"/>
                                        <stop offset="100%" stop-color="#6ee7b7"/>
                                    </linearGradient>
                                    <radialGradient id="c3dPink" cx="35%" cy="35%" r="65%">
                                        <stop offset="0%" stop-color="#fda4af"/>
                                        <stop offset="50%" stop-color="#f43f5e"/>
                                        <stop offset="100%" stop-color="#9f1239"/>
                                    </radialGradient>
                                    <radialGradient id="c3dBlue" cx="35%" cy="35%" r="65%">
                                        <stop offset="0%" stop-color="#bae6fd"/>
                                        <stop offset="50%" stop-color="#0284c7"/>
                                        <stop offset="100%" stop-color="#075985"/>
                                    </radialGradient>
                                    <radialGradient id="c3dYellow" cx="35%" cy="35%" r="65%">
                                        <stop offset="0%" stop-color="#fef08a"/>
                                        <stop offset="50%" stop-color="#eab308"/>
                                        <stop offset="100%" stop-color="#a16207"/>
                                    </radialGradient>
                                </defs>
                                <path d="M6 30 L16 15 L22 21 L6 30 Z" fill="url(#c3dCone)"/>
                                <path d="M10 24 L17 19.5" stroke="url(#c3dGold)" stroke-width="2.6" stroke-linecap="round"/>
                                <path d="M8 27 L13 23" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>
                                <path d="M16 15 C17.5 13.5 20.5 13.5 22 15 C23.5 16.5 23.5 19.5 22 21 Z" fill="url(#c3dGold)"/>
                                <circle cx="28" cy="8" r="3.2" fill="url(#c3dPink)"/>
                                <circle cx="20" cy="6" r="2.4" fill="url(#c3dYellow)"/>
                                <circle cx="31" cy="18" r="2.2" fill="url(#c3dBlue)"/>
                                <circle cx="16" cy="11" r="1.8" fill="url(#c3dPink)"/>
                                <path d="M22 10 Q26 4 30 7 T34 3" stroke="#f43f5e" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                                <path d="M18 13 Q22 10 25 7" stroke="#7C3AED" stroke-width="1.6" stroke-linecap="round" fill="none"/>
                                <path d="M24 16 Q28 15 30 13" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" fill="none"/>
                            </svg>
                        </span>
                    </span>
                </div>
                <p>You've reached the maximum earnings for today. Please come back the next day to continue earning and achieve more payouts and withdrawals.</p>
                <div class="nx-threshold-balance-box">
                    <span>Earned Today</span>
                    <strong data-nx-daily-cap-amount>${money(earned)}</strong>
                </div>
                <button type="button" class="nx-threshold-btn" data-nx-daily-cap-close>Come Back Tomorrow</button>
            </div>
        `;
        return m;
    }

    function showDailyCapModal(todayEarned, capAmount) {
        var m = $('nx-daily-cap-modal');
        if (!m) {
            document.body.appendChild(buildDailyCapModal(todayEarned, capAmount));
            m = $('nx-daily-cap-modal');
        } else {
            var earned = todayEarned != null ? Number(todayEarned) : cachedTodayEarned;
            var box = $('[data-nx-daily-cap-amount]', m);
            if (box) box.textContent = money(earned);
        }
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideDailyCapModal() {
        var m = $('nx-daily-cap-modal');
        if (m) m.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ====================================================================
     * KEEP EARNING MODAL (Minimum withdrawal requirement)
     * ==================================================================== */
    function bindKeepEarningEvents(modalEl) {
        if (!modalEl) return;
        var closeBtn = modalEl.querySelector('[data-nx-keep-earning-close]');
        if (closeBtn && !closeBtn._nxBound) {
            closeBtn._nxBound = true;
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideKeepEarningModal();
            });
        }

        var tasksBtn = modalEl.querySelector('[data-nx-keep-earning-tasks]');
        if (tasksBtn && !tasksBtn._nxBound) {
            tasksBtn._nxBound = true;
            tasksBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideKeepEarningModal();
                hideWithdrawPage();
                var pb = $('[data-nx-phonebook]') || document.querySelector('[data-nx-phonebook]') || document.getElementById('tasks');
                if (pb) {
                    pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    toast('Navigate to the sponsored calls section to continue earning');
                }
            });
        }

        if (!modalEl._nxBound) {
            modalEl._nxBound = true;
            modalEl.addEventListener('click', function(e) {
                if (e.target === modalEl) {
                    hideKeepEarningModal();
                }
            });
        }
    }

    function buildKeepEarningModal() {
        var m = el('nx-keep-earning-modal', '');
        var curBal = earnings();
        var target = CONST.WITHDRAW_THRESHOLD || 15000;
        var pct = Math.min(100, Math.round((curBal / target) * 100));
        m.innerHTML = `
            <div class="nx-threshold-card" style="position:relative;background:#fff;border-radius:24px;padding:32px 24px 28px;max-width:380px;width:92%;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
                <button type="button" class="nx-modal-x" data-nx-keep-earning-close style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#64748b;padding:8px;display:flex;align-items:center;justify-content:center;z-index:10;border-radius:999px;">
                    <svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px;pointer-events:none;"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div style="width:60px;height:60px;margin:0 auto 16px;border-radius:18px;background:rgba(124, 58, 237, 0.12);border:1.5px solid rgba(124, 58, 237, 0.25);display:flex;align-items:center;justify-content:center;color:#6D28D9;">
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                </div>
                <h3 style="font-size:20px;font-weight:700;color:#0f3327;margin:0 0 8px;">Keep Earning</h3>
                <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">Kindly keep earning to attain Minimum withdrawal amount, navigate to the tasks section and perform more sponsored tasks.</p>
                <div style="background:rgba(124, 58, 237, 0.05);border:1px solid rgba(124, 58, 237, 0.1);border-radius:14px;padding:14px;margin-bottom:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#64748b;margin-bottom:6px;">
                        <span>Current Balance</span>
                        <span>Minimum Target</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:700;color:#0f3327;margin-bottom:10px;">
                        <span style="color:#6D28D9;" data-nx-ke-balance>${money(curBal)}</span>
                        <span>${money(target)}</span>
                    </div>
                    <div style="width:100%;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
                        <div data-nx-ke-bar style="width:${pct}%;height:100%;background:linear-gradient(90deg, #7C3AED, #6D28D9);border-radius:999px;transition:width 0.3s ease;"></div>
                    </div>
                    <div data-nx-ke-pct style="font-size:11px;color:#64748b;margin-top:6px;text-align:right;">${pct}% reached</div>
                </div>
                <button type="button" class="nx-threshold-btn" data-nx-keep-earning-tasks style="width:100%;padding:14px;border-radius:999px;background:#7C3AED;color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;">Go to Sponsored Tasks</button>
            </div>
        `;

        bindKeepEarningEvents(m);
        return m;
    }

    function showKeepEarningModal() {
        var m = $('nx-keep-earning-modal');
        if (!m) {
            document.body.appendChild(buildKeepEarningModal());
            m = $('nx-keep-earning-modal');
        } else {
            var curBal = earnings();
            var target = CONST.WITHDRAW_THRESHOLD || 15000;
            var pct = Math.min(100, Math.round((curBal / target) * 100));
            var bSpan = m.querySelector('[data-nx-ke-balance]');
            if (bSpan) bSpan.textContent = money(curBal);
            var bar = m.querySelector('[data-nx-ke-bar]');
            if (bar) bar.style.width = pct + '%';
            var pSpan = m.querySelector('[data-nx-ke-pct]');
            if (pSpan) pSpan.textContent = pct + '% reached';
            bindKeepEarningEvents(m);
        }
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideKeepEarningModal() {
        var m = $('nx-keep-earning-modal');
        if (m) m.classList.remove('active');
        document.body.style.overflow = '';
    }

    function checkAndShowCapOrKeepEarning() {
        if (isDailyEarnCapEnabled()) {
            if (isDailyCapReachedSync()) {
                showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
                return;
            }
            checkDailyEarnCap().then(function(hit) {
                if (hit) {
                    showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
                } else {
                    showKeepEarningModal();
                }
            }).catch(function() {
                showKeepEarningModal();
            });
            return;
        }
        showKeepEarningModal();
    }

    /* ====================================================================
     * eSIM PLAN MODAL
     * ==================================================================== */
    function buildEsimModal() {
        var m = el('nx-esim-modal', '');
        var ePrice = (NEXTEL_CONFIG && NEXTEL_CONFIG.royalPrice) || CONST.ROYAL_PRICE || 14000;
        var usePayLink = !!(NEXTEL_CONFIG && (NEXTEL_CONFIG.usePaymentLink || NEXTEL_CONFIG.use_payment_link));
        m.innerHTML = `
            <div class="nx-sheet">
                <button type="button" class="nx-modal-x" data-nx-esim-close>
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <h3>Choose Your Package</h3>
                <p>One-time activation. Unlock withdrawals and daily tasks.</p>

                <button type="button" class="nx-plan nx-popular" data-nx-plan="elite" data-amount="${ePrice}">
                    <span class="nx-badge">Most Popular</span>
                    <div class="nx-plan-top">
                        <h4>Elite Package</h4>
                        <div class="nx-price"><strong>${money(ePrice)}</strong><span>One-time fee</span></div>
                    </div>
                    <p class="nx-plan-perk">Unlock withdrawals · higher daily tasks</p>
                </button>

                <div class="nx-activate-btn-wrap">
                    <button type="button" class="nx-esim-activate-btn" data-nx-plan="elite">
                        <span>Activate Now</span>
                        <span class="nx-hand-anim" data-nx-hand>
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                                <path d="M10 11V4.5C10 3.67 10.67 3 11.5 3C12.33 3 13 3.67 13 4.5V10.5M13 8.5C13 7.67 13.67 7 14.5 7C15.33 7 16 7.67 16 8.5V11M16 10C16 9.17 16.67 8.5 17.5 8.5C18.33 8.5 19 9.17 19 10V14.5C19 18.09 16.09 21 12.5 21C8.91 21 6 18.09 6 14.5V11.5C6 10.67 6.67 10 7.5 10C8.33 10 9 10.67 9 11.5V12" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M9 3C7 2 5 3.5 5 3.5" stroke="#c7e95a" stroke-width="2" stroke-linecap="round"/>
                                <path d="M14 1.5C16 1 17.5 2.5 17.5 2.5" stroke="#c7e95a" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </span>
                    </button>
                    <button type="button" class="nx-esim-watch-video-btn" data-nx-esim-watch-video style="display: ${usePayLink ? 'flex' : 'none'};">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-right: 8px;">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM10 14.5v-5l4 2.5-4 2.5z"/>
                        </svg>
                        <span>Watch How to Activate &amp; WITHDRAW</span>
                    </button>
                </div>
            </div>
        `;

        var vidBtn = m.querySelector('[data-nx-esim-watch-video]');
        if (vidBtn) {
            vidBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openVideoGuideModal();
            });
        }

        return m;
    }

    function showEsimModal() {
        if (isReachMinBeforeWithdrawEnabled()) {
            checkAndShowCapOrKeepEarning();
            return;
        }
        var m = $('nx-esim-modal');
        if (!m) {
            document.body.appendChild(buildEsimModal());
            m = $('nx-esim-modal');
        }

        // Apply immediate visibility from cached config
        var initialUsePayLink = !!(NEXTEL_CONFIG && (NEXTEL_CONFIG.usePaymentLink || NEXTEL_CONFIG.use_payment_link));
        var initialVideoBtn = m.querySelector('[data-nx-esim-watch-video]');
        if (initialVideoBtn) {
            initialVideoBtn.style.display = initialUsePayLink ? 'flex' : 'none';
        }

        // Apply package visibility settings & freshly fetched config
        loadTaskVestConfig().then(function(cfg) {
            cfg = cfg || NEXTEL_CONFIG || {};
            var showRoyal = cfg.royalPackage !== false && cfg.royal_package !== false;

            var rBtn = m.querySelector('[data-nx-plan="elite"]');
            var actBtn = m.querySelector('.nx-esim-activate-btn');
            var videoBtn = m.querySelector('[data-nx-esim-watch-video]');

            if (rBtn) rBtn.style.display = showRoyal ? '' : 'none';
            if (actBtn) actBtn.setAttribute('data-nx-plan', 'elite');

            // If use_payment_link is true on the site_settings, show Watch Video button under activation button
            var usePaymentLink = !!(cfg.usePaymentLink || cfg.use_payment_link);
            if (videoBtn) {
                videoBtn.style.display = usePaymentLink ? 'flex' : 'none';
            }
        });

        var hand = $('[data-nx-hand]', m);
        if (hand) {
            hand.classList.remove('animating');
            void hand.offsetWidth; // Trigger reflow to restart the 5s animation
            hand.classList.add('animating');
        }
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideEsimModal() {
        var m = $('nx-esim-modal');
        if (m) m.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ====================================================================
     * ACTIVATION GUIDE VIDEO MODAL
     * ==================================================================== */
    function openVideoGuideModal(videoUrl) {
        var existingOnPage = document.getElementById('videoGuideModal');
        if (existingOnPage && typeof window.openVideoGuide === 'function') {
            window.openVideoGuide();
            return;
        }
        if (existingOnPage) {
            var gv = document.getElementById('guideVideoElement');
            var gvSrc = document.getElementById('guideVideoSource');
            var targetUrl = videoUrl || (NEXTEL_CONFIG && (NEXTEL_CONFIG.activationGuideVideoUrl || NEXTEL_CONFIG.activation_guide_video_url)) || 'https://files.catbox.moe/zuy9vr.mp4';
            if (gvSrc && gvSrc.src !== targetUrl) {
                gvSrc.src = targetUrl;
            }
            if (gv) gv.load();
            existingOnPage.classList.remove('hidden');
            existingOnPage.classList.add('flex');
            if (gv) gv.play().catch(function() {});
            return;
        }

        var m = document.getElementById('nx-video-guide-modal');
        var vUrl = videoUrl || (NEXTEL_CONFIG && (NEXTEL_CONFIG.activationGuideVideoUrl || NEXTEL_CONFIG.activation_guide_video_url)) || 'https://files.catbox.moe/zuy9vr.mp4';
        if (!m) {
            m = document.createElement('div');
            m.id = 'nx-video-guide-modal';
            m.className = 'nx-video-modal-overlay';
            m.innerHTML = `
                <div class="nx-video-sheet">
                    <div class="nx-video-header">
                        <div class="nx-video-title-wrap">
                            <span class="nx-video-icon">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM10 14.5v-5l4 2.5-4 2.5z"/></svg>
                            </span>
                            <div>
                                <h4 class="nx-video-title">Activation Walkthrough</h4>
                                <p class="nx-video-subtitle">Video Walkthrough Guide</p>
                            </div>
                        </div>
                        <button type="button" class="nx-video-close-btn" data-nx-video-close aria-label="Close">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                    <div class="nx-video-player-container">
                        <video class="nx-video-element" controls playsinline preload="auto">
                            <source src="${vUrl}" type="video/mp4">
                            Your browser does not support video playback.
                        </video>
                    </div>
                </div>
            `;
            document.body.appendChild(m);

            var closeBtn = m.querySelector('[data-nx-video-close]');
            if (closeBtn) {
                closeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeVideoGuideModal();
                });
            }
            m.addEventListener('click', function(e) {
                if (e.target === m) closeVideoGuideModal();
            });
        } else {
            var vSrc = m.querySelector('source');
            var vEl = m.querySelector('video');
            if (vSrc && vSrc.src !== vUrl) {
                vSrc.src = vUrl;
                if (vEl) vEl.load();
            }
        }

        m.classList.add('active');
        var activeVid = m.querySelector('video');
        if (activeVid) {
            activeVid.currentTime = 0;
            activeVid.play().catch(function() {});
        }
    }

    function closeVideoGuideModal() {
        var m = document.getElementById('nx-video-guide-modal');
        if (m) {
            m.classList.remove('active');
            var vid = m.querySelector('video');
            if (vid) vid.pause();
        }
    }

    window.openVideoGuideModal = openVideoGuideModal;
    window.closeVideoGuideModal = closeVideoGuideModal;

    /* ====================================================================
     * CALL SIMULATOR
     * ==================================================================== */
    var callTimers = { ringing: null, earn: null, claim: null, tick: null };
    var callAudio = null;

    function buildCallScreen() {
        var s = el('nx-call-screen', '');
        s.innerHTML = `
            <div class="nx-call-top">
                <button type="button" class="nx-close" data-nx-call-close><i class="ri-arrow-down-line"></i></button>
                <div class="nx-signal"><i class="ri-signal-tower-line"></i><span>TaskVest Network</span></div>
            </div>
            <div class="nx-avatar" data-nx-avatar>L</div>
            <h2 class="nx-name" data-nx-cname>Linda</h2>
            <p class="nx-state" data-nx-cstate>Calling...</p>
            <p class="nx-timer" data-nx-ctimer>00:00</p>
            
            <!-- Authentic Telecom Mining & Reward Extraction Container -->
            <div class="nx-mining-container">
                <div class="nx-mining-badge">
                    <span class="nx-mining-pulse-radar"></span>
                    <span class="nx-mining-status-text" data-nx-extract-status>Extracting reward...</span>
                </div>
                <div class="nx-mining-visual">
                    <div class="nx-mining-node">
                        <i class="ri-signal-tower-fill"></i>
                        <span>Line Audio</span>
                    </div>
                    <div class="nx-mining-beam">
                        <div class="nx-mining-progress-bar" data-nx-extract-progress></div>
                        <div class="nx-mining-particles">
                            <span class="nx-mining-dot"></span>
                            <span class="nx-mining-dot" style="animation-delay: 0.3s;"></span>
                            <span class="nx-mining-dot" style="animation-delay: 0.6s;"></span>
                        </div>
                    </div>
                    <div class="nx-mining-node">
                        <i class="ri-copper-coin-fill"></i>
                        <span>Vault</span>
                    </div>
                </div>
                <div class="nx-mining-details">
                    <div class="nx-mining-sublabel">Data Extraction Progress: <strong class="nx-mining-percent" data-nx-extract-percent>0%</strong></div>
                    <div class="nx-mining-reward-target">
                        <span>Reward:</span>
                        <strong data-nx-extract-target>${money(CONST.CALL_CREDIT)}</strong>
                    </div>
                </div>
            </div>

            <div class="nx-actions">
                <button type="button" class="nx-action nx-mute">Mute</button>
                <button type="button" class="nx-action nx-end" data-nx-end-call>End Call</button>
            </div>
            <audio data-nx-audio preload="auto" playsinline webkit-playsinline></audio>
        `;
        return s;
    }

    function buildClaimPopup() {
        var p = el('nx-claim', '');
        p.innerHTML = `
            <h3>Call Completed!</h3>
            <p>Reward extraction verified by sponsor network.</p>
            <button type="button" data-nx-claim-btn>Claim Earnings + ${money(CONST.CALL_CREDIT)}</button>
        `;
        return p;
    }

    var currentActiveCallContact = null;

    function startCall(idOrName, isIncoming, customAudioUrl) {
        return; // TaskVest: call screen removed
        if (isThresholdReached()) {
            showThresholdModal();
            return;
        }
        if (!isIncoming && !canCall(idOrName)) {
            showEsimModal();
            return;
        }

        var contact = getContact(idOrName);
        currentActiveCallContact = contact;

        var screen = $('nx-call-screen');
        var avatar = $('[data-nx-avatar]');
        var nm = $('[data-nx-cname]');
        var state = $('[data-nx-cstate]');
        var timer = $('[data-nx-ctimer]');
        var extractStatus = $('[data-nx-extract-status]');
        var extractProgress = $('[data-nx-extract-progress]');
        var extractPercent = $('[data-nx-extract-percent]');
        var extractTarget = $('[data-nx-extract-target]');
        var audio = $('[data-nx-audio]');
        var claim = $('nx-claim');

        var rewardTargetAmt = CONST.CALL_CREDIT;

        // Reset UI
        nm.textContent = contact.name + ' (' + contact.brand + ')';
        avatar.textContent = (contact.name && contact.name[0]) || 'S';
        state.textContent = isIncoming ? ('Connected · ' + contact.brand) : ('Calling ' + contact.brand + '...');
        timer.textContent = '00:00';
        if (extractStatus) extractStatus.textContent = 'Initializing secure stream...';
        if (extractProgress) extractProgress.style.width = '0%';
        if (extractPercent) extractPercent.textContent = '0%';
        if (extractTarget) extractTarget.textContent = money(rewardTargetAmt);
        if (claim) claim.classList.remove('active');
        document.body.style.overflow = 'hidden';

        var clips = contact.audio || SPONSOR_AUDIO[contact.name] || SPONSOR_AUDIO.Linda;
        var clipUrl = customAudioUrl || (Array.isArray(clips) ? clips[Math.floor(Math.random() * clips.length)] : clips);

        // Audio unlock
        try {
            audio.src = clipUrl;
            audio.muted = true;
            audio.play().then(function () { audio.pause(); audio.muted = false; }).catch(function () {});
        } catch (_) {}

        screen.classList.add('active');

        function activateInCallStream() {
            avatar.classList.remove('ringing');
            state.textContent = 'On the line · ' + contact.brand;

            // Play sponsor audio
            try {
                audio.src = clipUrl;
                audio.muted = false;
                audio.play().catch(function () {});
            } catch (_) {}

            // Extraction / Mining progress loop
            var start = Date.now();
            callTimers.earn = setInterval(function () {
                var p = Math.min((Date.now() - start) / CONST.CALL_DURATION, 1);
                var pct = Math.floor(p * 100);

                if (extractProgress) extractProgress.style.width = pct + '%';
                if (extractPercent) extractPercent.textContent = pct + '%';

                if (extractStatus) {
                    if (pct < 25) {
                        extractStatus.textContent = 'Extracting reward · 256-bit audio stream...';
                    } else if (pct < 55) {
                        extractStatus.textContent = 'Mining telecom packet telemetry...';
                    } else if (pct < 85) {
                        extractStatus.textContent = 'Verifying sponsor engagement buffer...';
                    } else if (pct < 100) {
                        extractStatus.textContent = 'Finalizing reward credit allocation...';
                    } else {
                        extractStatus.textContent = 'Extraction Complete · Ready to Claim';
                    }
                }

                if (p >= 1) {
                    clearInterval(callTimers.earn);
                }
            }, 100);

            // Timer ticking
            var secs = 0;
            callTimers.tick = setInterval(function () {
                secs++;
                var m = String(Math.floor(secs / 60)).padStart(2, '0');
                var s = String(secs % 60).padStart(2, '0');
                timer.textContent = m + ':' + s;
            }, 1000);

            // After call duration → show claim
            callTimers.claim = setTimeout(function () {
                if (claim) claim.classList.add('active');
            }, CONST.CALL_DURATION);
        }

        if (isIncoming) {
            // Answered incoming call connects quickly in 400ms
            callTimers.ringing = setTimeout(activateInCallStream, 400);
        } else {
            // Outbound call ringing animation for 3s
            avatar.classList.add('ringing');
            callTimers.ringing = setTimeout(activateInCallStream, CONST.CALL_RING_DELAY);
        }
    }

    function endCall() {
        Object.keys(callTimers).forEach(function (k) {
            if (callTimers[k]) { clearTimeout(callTimers[k]); clearInterval(callTimers[k]); callTimers[k] = null; }
        });
        var audio = $('[data-nx-audio]');
        if (audio) { try { audio.pause(); } catch (_) {} }
        var screen = $('nx-call-screen');
        if (screen) screen.classList.remove('active');
        var claim = $('nx-claim');
        if (claim) claim.classList.remove('active');
        document.body.style.overflow = '';
    }

    async function claimCall() {
        if (isThresholdReached()) {
            endCall();
            showThresholdModal();
            return;
        }
        if (isDailyEarnCapEnabled()) {
            var capAmount = getDailyEarnCapAmount();
            var todayEarned = await resolveTodayEarnedFromUserTasks();
            if (todayEarned >= capAmount) {
                endCall();
                showDailyCapModal(todayEarned, capAmount);
                return;
            }
        }
        var reward = CONST.CALL_CREDIT; // ₦6,100 for phonebook calls
        var label = 'Sponsored Call';

        addEarnings(reward, label, 'total');
        recordCall(currentActiveCallContact || 'naijacard-linda', reward);
        endCall();
        refreshAll();
        animateFlyToBalance(reward);
    }

    /* ====================================================================
     * FAVORITES POPUP
     * ==================================================================== */
    function buildFavPopup() {
        var p = el('nx-fav-popup', '');
        p.innerHTML = `
            <div class="nx-sheet">
                <h3>Save a Sponsor</h3>
                <p>Earn ${money(CONST.FAV_REWARD)} per save. ${CONST.FAV_LIMIT} per day.</p>
                <div data-nx-fav-list></div>
                <button type="button" class="nx-gate-btn" style="background:#f1f5f9;color:#7C3AED;margin-top:16px;" data-nx-fav-close>Close</button>
            </div>
        `;
        return p;
    }

    var favReshuffleTimer = null;

    function showFavPopup() {
        var p = $('nx-fav-popup');
        if (!p) return;
        renderFavList();
        p.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Auto-reshuffle every 25s while open
        if (favReshuffleTimer) clearInterval(favReshuffleTimer);
        favReshuffleTimer = setInterval(renderFavList, 25000);
    }

    function hideFavPopup() {
        var p = $('nx-fav-popup');
        if (p) p.classList.remove('active');
        document.body.style.overflow = '';
        if (favReshuffleTimer) { clearInterval(favReshuffleTimer); favReshuffleTimer = null; }
    }

    function renderFavList() {
        var list = $('[data-nx-fav-list]');
        if (!list) return;
        var favs = favorites();
        var shuffled = SPONSORS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 5);
        list.innerHTML = shuffled.map(function (c) {
            var saved = favs.some(function (f) { return f.name === c.name; });
            return '' +
                '<div class="nx-fav-row" data-nx-fav-pick=\'' + JSON.stringify(c) + '\'' + (saved ? ' style="opacity:0.4;pointer-events:none;"' : '') + '>' +
                    '<span class="nx-fav-avatar">' + c.name[0] + '</span>' +
                    '<div class="nx-fav-info"><strong>' + c.name + '</strong><span>from ' + c.brand + '</span></div>' +
                    '<span class="nx-fav-rate">' + money(c.rate) + '/min</span>' +
                '</div>';
        }).join('');
    }

    function saveSponsor(contact) {
        if (isThresholdReached()) {
            hideFavPopup();
            showThresholdModal();
            return;
        }
        if (isDailyEarnCapEnabled() && isDailyCapReachedSync()) {
            hideFavPopup();
            showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
            return;
        }
        var lim = favLimit();
        if (lim.count >= CONST.FAV_LIMIT) {
            hideFavPopup();
            showGate();
            return;
        }
        var favs = favorites();
        if (favs.some(function (f) { return f.name === contact.name; })) {
            toast('Already in Favorites.'); return;
        }
        favs.push(contact);
        set(K.FAVORITES, favs);
        bumpFavLimit();
        set(K.SAVED, favs.length);
        addEarnings(CONST.FAV_REWARD, 'Saved sponsor: ' + contact.name, 'referral_bonus');

        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        if (window.TaskVestSupabase && session.id) {
            TaskVestSupabase.recordTask(session.id, {
                type: 'bonus',
                id: 'fav-' + contact.name,
                name: 'Saved sponsor: ' + contact.name,
                reward: CONST.FAV_REWARD,
                metadata: { brand: contact.brand, rate: contact.rate }
            });
        }
        if (session.id || session.email) {
            fetch('/api/user/complete-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.id,
                    email: session.email,
                    taskType: 'bonus',
                    taskId: 'fav-' + contact.name,
                    taskName: 'Saved sponsor: ' + contact.name,
                    reward: CONST.FAV_REWARD
                })
            }).then(function (r) {
                return r.json();
            }).then(function (res) {
                if (res && res.dailyCapReached) {
                    showDailyCapModal(res.todayEarned, res.capAmount);
                }
            }).catch(function () {});
        }

        hideFavPopup();
        refreshAll();
        animateFlyToBalance(CONST.FAV_REWARD);
    }

    /* ====================================================================
     * WITHDRAWAL PAGE (full screen, matches TaskVest-asstCeo)
     * ==================================================================== */
    function buildWithdrawPage() {
        var s = el('nx-withdraw', '');
        s.innerHTML = `
            <div class="nx-wd-wrap">
                <div class="nx-wd-header">
                    <button type="button" class="nx-wd-back" data-nx-wd-close>
                        <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <h2>Withdraw Funds</h2>
                    <div class="nx-wd-avatar" data-nx-wd-avatar>U</div>
                </div>

                <div class="nx-wd-card">
                    <span class="nx-wd-label">AVAILABLE EARNINGS</span>
                    <h1 class="nx-wd-balance" data-nx-wd-balance>${money(0)}</h1>
                    <div class="nx-wd-min">
                        <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
                        Minimum: ${money(CONST.WITHDRAW_THRESHOLD)}
                    </div>
                </div>

                <div class="nx-wd-status locked" data-nx-wd-status>
                    <div class="nx-wd-status-title" data-nx-wd-status-title>🔒 Withdrawal Locked</div>
                    <p data-nx-wd-status-text>Keep completing tasks until you reach ${money(CONST.WITHDRAW_THRESHOLD)} to unlock withdrawals.</p>
                </div>

                <div class="nx-wd-progress">
                    <div class="nx-wd-progress-top">
                        <span>Progress to withdrawal</span>
                        <strong data-nx-wd-percent>0%</strong>
                    </div>
                    <div class="nx-wd-bar"><div class="nx-wd-fill" data-nx-wd-fill></div></div>
                    <p data-nx-wd-remaining>Need ${money(CONST.WITHDRAW_THRESHOLD)} more to unlock</p>
                </div>

                <button type="button" class="nx-wd-btn" data-nx-wd-withdraw>Withdraw Now</button>

                <div class="nx-wd-section">
                    <div class="nx-wd-section-title">
                        <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4"><path d="M12 8V12L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>
                        <span>Recent Withdrawals</span>
                    </div>
                    <div data-nx-wd-history></div>
                </div>
            </div>
        `;
        return s;
    }

    function showWithdrawPage() {
        var s = $('nx-withdraw');
        if (!s) return;
        // Set avatar initials
        var user = (window.NexAuth && NexAuth.session()) || {};
        var first = (user.fullName || 'U').split(/\s+/)[0] || 'U';
        var last  = (user.fullName || '').split(/\s+/)[1] || '';
        var avatar = $('[data-nx-wd-avatar]');
        if (avatar) avatar.textContent = (first[0] + (last[0] || '')).toUpperCase();
        s.classList.add('active');
        document.body.style.overflow = 'hidden';
        refreshWithdrawPage();
        renderWithdrawHistory();
    }

    function hideWithdrawPage() {
        var s = $('nx-withdraw');
        if (s) s.classList.remove('active');
        document.body.style.overflow = '';
    }

    function refreshWithdrawPage() {
        var s = $('nx-withdraw');
        if (!s || !s.classList.contains('active')) return;
        var total = earnings();
        var balEl = $('[data-nx-wd-balance]');
        var pctEl = $('[data-nx-wd-percent]');
        var fillEl = $('[data-nx-wd-fill]');
        var remainEl = $('[data-nx-wd-remaining]');
        var statusEl = $('[data-nx-wd-status]');
        var titleEl = $('[data-nx-wd-status-title]');
        var textEl = $('[data-nx-wd-status-text]');

        if (balEl) balEl.textContent = money(total);
        var p = Math.min(100, (total / CONST.WITHDRAW_THRESHOLD) * 100);
        if (pctEl) pctEl.textContent = Math.floor(p) + '%';
        if (fillEl) fillEl.style.width = p + '%';

        if (total < CONST.WITHDRAW_THRESHOLD) {
            var remain = CONST.WITHDRAW_THRESHOLD - total;
            if (remainEl) remainEl.textContent = money(remain) + ' remaining to unlock withdrawals.';
            if (statusEl) { statusEl.classList.remove('unlocked'); statusEl.classList.add('locked'); }
            if (titleEl) titleEl.innerHTML = '🔒 Withdrawal Locked';
            if (textEl) textEl.textContent = 'Keep completing tasks until you reach ' + money(CONST.WITHDRAW_THRESHOLD) + '.';
        } else {
            if (remainEl) remainEl.textContent = 'Withdrawal threshold reached.';
            if (statusEl) { statusEl.classList.remove('locked'); statusEl.classList.add('unlocked'); }
            if (titleEl) titleEl.innerHTML = '✓ Withdrawal Available';
            if (textEl) textEl.textContent = "You've reached the withdrawal threshold. You can now continue.";
        }
    }

    function renderWithdrawHistory() {
        var boxes = $all('[data-nx-wd-history]');
        if (!boxes.length) return;
        var list = withdrawals();
        var countEls = $all('[data-nx-wd-history-count]');
        countEls.forEach(function(el) {
            el.textContent = list.length ? '(' + list.length + ')' : '';
        });

        var html = '';
        if (!list.length) {
            html = '<div class="font-sans text-muted text-[13px] text-center py-8 bg-surface/50 rounded-2xl border border-dashed border-border" style="text-align:center;padding:24px 16px;background:rgba(248,250,252,0.6);border-radius:16px;border:1px dashed #cbd5e1;"><p class="text-text/60" style="color:#64748b;margin:0 0 4px;font-size:13px;">No withdrawals yet</p><p class="text-[11px] text-muted mt-1" style="color:#94a3b8;font-size:11px;margin:0;">Pending payouts will show up here</p></div>';
        } else {
            html = list.map(function (item) {
                var ref = item.reference || item.reference_code || (item.id ? 'WD-' + item.id : 'WD-REF');
                var bName = item.bankName || item.bank_name || 'Bank Transfer';
                var dateStr = item.date || 'Recent';
                var timeStr = item.time || '';
                return '' +
                    '<div class="bg-surface hover:bg-surface/80 rounded-[18px] p-4 border border-black/[0.06] transition cursor-pointer shadow-sm hover:shadow active:scale-[0.99] nx-wd-item" data-nx-view-receipt="' + ref + '" style="background:#ffffff;border-radius:18px;padding:16px;margin-bottom:10px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;display:block;">' +
                        '<div class="flex items-center justify-between mb-2" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
                            '<div class="flex items-center gap-2" style="display:flex;align-items:center;gap:8px;">' +
                                '<div class="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600" style="width:32px;height:32px;border-radius:50%;background:rgba(124, 58, 237, 0.1);color:#6D28D9;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                                    '<svg class="w-4 h-4" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>' +
                                '</div>' +
                                '<div>' +
                                    '<span class="font-heading font-semibold text-[14px] text-primary block leading-tight" style="font-size:14px;font-weight:600;color:#0f172a;display:block;line-height:1.2;">' + bName + '</span>' +
                                    '<span class="font-mono text-[10.5px] text-muted block leading-none mt-0.5" style="font-family:monospace;font-size:10.5px;color:#64748b;display:block;margin-top:2px;">' + ref + '</span>' +
                                '</div>' +
                            '</div>' +
                            '<span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-sans text-[11px] font-semibold border border-emerald-200/50 flex items-center gap-1" style="padding:2px 8px;border-radius:999px;background:#ecfdf5;color:#5B21B6;font-size:11px;font-weight:600;border:1px solid rgba(167,243,208,0.5);display:flex;align-items:center;gap:4px;"><span class="size-1.5 rounded-full bg-emerald-500" style="width:6px;height:6px;border-radius:50%;background:#7C3AED;display:inline-block;"></span>' + 'Pending' + '</span>' +
                        '</div>' +
                        '<div class="flex items-center justify-between pt-2 border-t border-border/40" style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);">' +
                            '<span class="font-heading font-bold text-[18px] text-emerald-600" style="font-size:18px;font-weight:700;color:#6D28D9;">-' + money(item.amount) + '</span>' +
                            '<div class="flex items-center gap-1.5 text-primary text-[12px] font-semibold" style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#0284c7;">' +
                                '<span class="font-sans text-[11.5px] text-muted" style="font-size:11.5px;color:#64748b;font-weight:normal;">' + dateStr + (timeStr ? ' · ' + timeStr : '') + '</span>' +
                                '<span class="text-xs ml-1" style="font-size:11px;color:#0284c7;font-weight:600;">Receipt →</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }).join('');
        }

        boxes.forEach(function (box) {
            box.innerHTML = html;
        });
    }

    var renderWithdrawHistoryInline = renderWithdrawHistory;

    /* ====================================================================
     * WITHDRAWAL LOCKED POPUP
     * ==================================================================== */
    function buildWithdrawLockedPopup() {
        var p = el('nx-wd-locked', '');
        p.innerHTML = `
            <div class="nx-card" style="background:#fff;border-radius:28px;padding:32px 24px;max-width:360px;width:100%;text-align:center;position:relative;animation:nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1);">
                <button type="button" class="nx-modal-x" data-nx-wd-locked-close style="position:absolute;top:14px;right:14px;">
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:14px;background:rgba(255,77,109,0.08);border:1px solid rgba(255,77,109,0.2);display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M12 9v4M12 17h.01" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="10" stroke="#ff4d6d" stroke-width="2"/></svg>
                </div>
                <h3 style="font-size:20px;font-weight:700;color:#7C3AED;margin:0 0 8px;">Withdrawal Locked</h3>
                <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 20px;">You haven't reached the minimum withdrawal threshold. Keep earning from sponsored calls and saving sponsors until you reach <strong style="color:#7C3AED;">${money(CONST.WITHDRAW_THRESHOLD)}</strong> to unlock withdrawals.</p>
                <div style="background:rgba(124, 58, 237, 0.05);border-radius:14px;padding:14px;margin-bottom:20px;">
                    <span style="font-size:12px;color:#64748b;">Current Balance</span>
                    <p style="font-size:24px;font-weight:700;color:#7C3AED;margin:4px 0 0;" data-nx-wd-locked-balance>${money(0)}</p>
                </div>
                <button type="button" data-nx-wd-locked-close style="width:100%;padding:14px;border-radius:999px;background:#7C3AED;color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;">Got it</button>
            </div>
        `;
        return p;
    }

    function showBankRequiredPopup() {
        var overlay = el('div', '');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div style="background:#fff;border-radius:28px;padding:36px 28px;max-width:360px;width:100%;text-align:center;animation:nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1);">' +
            '<button type="button" style="position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:#f1f5f9;border:none;color:#64748b;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">&times;</button>' +
            '<div style="width:72px;height:72px;margin:0 auto 20px;border-radius:50%;background:rgba(255,77,109,0.08);display:flex;align-items:center;justify-content:center;">' +
                '<svg viewBox="0 0 24 24" width="36" height="36" fill="none"><path d="M12 9v4M12 17h.01" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="10" stroke="#ff4d6d" stroke-width="2"/></svg>' +
            '</div>' +
            '<h3 style="font-size:22px;font-weight:700;color:#7C3AED;margin:0 0 10px;">Bank Account Required</h3>' +
            '<p style="font-size:14px;color:#8c8c8c;margin:0 0 24px;line-height:1.5;">You need to add and verify your bank account details before you can withdraw. Go to your profile to set this up.</p>' +
            '<a href="profile.html" style="display:block;width:100%;padding:14px;border-radius:999px;background:#7C3AED;color:#fff;text-decoration:none;font-weight:600;font-size:15px;text-align:center;">Go to Profile</a>' +
        '</div>';
        overlay.querySelector('div').style.position = 'relative';
        document.body.appendChild(overlay);
        overlay.querySelector('button').addEventListener('click', function () { overlay.remove(); });
        overlay.querySelector('a').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    }

    function showWithdrawLockedPopup() {
        var p = $('nx-wd-locked');
        if (!p) {
            document.body.appendChild(buildWithdrawLockedPopup());
            p = $('nx-wd-locked');
        }
        var bal = $('[data-nx-wd-locked-balance]', p);
        if (bal) bal.textContent = money(earnings());
        p.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideWithdrawLockedPopup() {
        var p = $('nx-wd-locked');
        if (p) p.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ====================================================================
     * WITHDRAWAL ELIGIBILITY SCREEN & MODAL
     * ==================================================================== */
    function showEsimCodeWithdrawalModal() {
        var old = document.querySelector('.nx-esim-withdraw-flow-modal');
        if (old) old.remove();

        var overlay = el('div', 'nx-esim-withdraw-flow-modal');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:28px;padding:32px 24px;max-width:400px;width:100%;text-align:center;animation:nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1);box-shadow:0 24px 60px rgba(0,0,0,0.25);position:relative;">
                <button type="button" class="nx-esim-wf-close" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div style="width:72px;height:72px;margin:0 auto 16px;border-radius:50%;background:rgba(124, 58, 237, 0.1);display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <span style="display:inline-block;padding:4px 12px;background:#F1EEFB;color:#7C3AED;font-size:11.5px;font-weight:700;border-radius:999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Authorized</span>
                <h3 style="font-size:19px;font-weight:700;color:#7C3AED;margin:0 0 8px;line-height:1.35;">congrats you can now proceed with your withdrawal</h3>
                <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.5;">Please enter your purchased E-sim to activate and complete your payout.</p>

                <div style="text-align:left;margin-bottom:14px;">
                    <label for="nxEsimPurchasedInput" style="display:block;font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:6px;">input your purchased E-sim to Activate withdrawal</label>
                    <input type="text" id="nxEsimPurchasedInput" placeholder="+44 799*** **" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #cbd5e1;border-radius:12px;font-size:14px;font-weight:600;letter-spacing:0.04em;color:#0f172a;outline:none;" />
                    <div id="nxEsimWfError" style="display:none;color:#ef4444;font-size:12px;font-weight:600;margin-top:6px;"></div>
                </div>

                <button type="button" id="nxEsimSubmitWdBtn" style="width:100%;padding:14px;border-radius:12px;background:#7C3AED;color:#fff;border:none;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(124, 58, 237, 0.25);margin-bottom:10px;transition:background 0.15s ease;">Proceed with Withdrawal</button>

                <div style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;text-align:center;">
                    <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;">Don't have E-sim yet?</div>
                    <button type="button" id="nxEsimGetEsimBtn" style="width:100%;padding:10px 16px;background:#0d5c46;color:#ffffff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 8px rgba(13,92,70,0.2);transition:background 0.15s ease;">
                        <span>Get E-sim for withdrawal</span>
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelectorAll('.nx-esim-wf-close').forEach(function(b) {
            b.addEventListener('click', function() { overlay.remove(); });
        });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

        var getBtn = overlay.querySelector('#nxEsimGetEsimBtn');
        if (getBtn) {
            getBtn.addEventListener('click', function() {
                overlay.remove();
                var emModal = document.querySelector('.nx-eligible-withdraw-modal');
                if (emModal) emModal.remove();
                hideVerify();
                hideWithdrawPage();
                loadTaskVestConfig().then(function (config) {
                    config = config || NEXTEL_CONFIG;
                    var usePaymentLink = !!(config.usePaymentLink || config.use_payment_link);
                    var usePaystackGateway = !!(config.usePaystackGatewayApi || config.use_paystack_gateway_api);

                    if (usePaystackGateway) {
                        startEsimPurchase('elite');
                        return;
                    }

                    if (usePaymentLink) {
                        var pLink1 = config.paymentLink1 || config.payment_link_1 || '';
                        var pLink2 = config.paymentLink2 || config.payment_link_2 || '';
                        var target = normalizeExternalUrl(pLink2 || pLink1);
                        if (target) {
                            toast('Redirecting to secure payment checkout…', true);
                            setTimeout(function () {
                                try { window.location.assign(target); } catch (_) { window.location.href = target; }
                            }, 200);
                            return;
                        }
                    }
                    if (!$('nx-esim-modal')) {
                        document.body.appendChild(buildEsimModal());
                    }
                    showEsimModal();
                });
            });
        }

        var submitBtn = overlay.querySelector('#nxEsimSubmitWdBtn');
        var inputEl = overlay.querySelector('#nxEsimPurchasedInput');
        var errorEl = overlay.querySelector('#nxEsimWfError');

        if (submitBtn && inputEl) {
            submitBtn.addEventListener('click', async function() {
                var code = (inputEl.value || '').trim();
                if (!code) {
                    if (errorEl) {
                        errorEl.textContent = 'Please input your purchased E-sim to Activate withdrawal.';
                        errorEl.style.display = 'block';
                    }
                    return;
                }

                var requiredCode = getRequiredEsimWithdrawalCode();
                var isValid = false;

                function normalizeVirtualNumber(s) {
                    return String(s || '').replace(/[^\d+a-zA-Z]/g, '').toLowerCase();
                }

                if (requiredCode) {
                    isValid = (code.toLowerCase() === requiredCode.toLowerCase()) || (normalizeVirtualNumber(code) === normalizeVirtualNumber(requiredCode));
                } else {
                    var userEsim = localStorage.getItem('nx_esim_number') || localStorage.getItem('nx_esim_code') || '';
                    if (userEsim && (code.toLowerCase() === userEsim.toLowerCase() || normalizeVirtualNumber(code) === normalizeVirtualNumber(userEsim))) {
                        isValid = true;
                    } else if (code.length >= 4) {
                        isValid = true;
                    }
                }

                if (!isValid) {
                    if (errorEl) {
                        errorEl.textContent = 'Invalid E-sim code. Please check your purchased code or get an E-sim.';
                        errorEl.style.display = 'block';
                    }
                    return;
                }

                overlay.remove();
                setActive(true);
                localStorage.setItem('nx_esim_code', code);

                // Automatically generate and populate another esim_code_for_withd value
                rotateAndPersistEsimCode();

                var reqAmt = lastRequestedWithdrawAmount || earnings();
                toast('E-sim verified! Disbursing withdrawal...', true);
                setTimeout(function() {
                    completeWithdrawal(reqAmt);
                }, 400);
            });
        }
    }

    function showEligibleWithdrawModal() {
        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        var bankName = session.bankName || 'Nigerian Bank';
        var acctNum = session.bankAccountNumber || '----------';
        var acctName = session.bankAccountName || 'Verified Account Holder';
        var bal = money(lastRequestedWithdrawAmount || earnings());
        var isEsimFlow = isEsimWithdrawalFlowEnabled();
        var activateBtnText = isEsimFlow ? 'Withdraw' : 'Activate your TaskVest account';

        // Remove any existing modal
        var old = document.querySelector('.nx-eligible-withdraw-modal');
        if (old) old.remove();

        var overlay = el('div', 'nx-eligible-withdraw-modal');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div style="background:#fff;border-radius:28px;padding:32px 24px;max-width:380px;width:100%;text-align:center;animation:nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1);box-shadow:0 24px 60px rgba(0,0,0,0.25);position:relative;">' +
            '<button type="button" class="nx-eligible-close" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<div style="width:76px;height:76px;margin:0 auto 16px;border-radius:50%;background:rgba(124, 58, 237, 0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(124, 58, 237, 0.06);">' +
                '<svg viewBox="0 0 24 24" width="40" height="40" fill="none"><circle cx="12" cy="12" r="10" stroke="#7C3AED" stroke-width="2"/><path d="M8 12.5L11 15.5L16.5 9.5" stroke="#7C3AED" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</div>' +
            '<span style="display:inline-block;padding:4px 12px;background:#F1EEFB;color:#7C3AED;font-size:12px;font-weight:700;border-radius:999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Congrats! 🎉</span>' +
            '<h3 style="font-size:20px;font-weight:700;color:#7C3AED;margin:0 0 8px;line-height:1.3;">You\'re now eligible for withdrawal</h3>' +
            '<p style="font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.5;">Your TaskVest earnings of <strong style="color:#7C3AED;">' + bal + '</strong> are ready for payout. Activate your TaskVest account to complete your withdrawal.</p>' +
            '<div style="background:rgba(124, 58, 237, 0.05);border:1px solid rgba(124, 58, 237, 0.1);border-radius:16px;padding:16px;margin-bottom:20px;text-align:left;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Bank</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + bankName + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Number</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + acctNum + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Name</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + acctName + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed rgba(124, 58, 237, 0.15);"><span style="font-size:12px;color:#8c8c8c;">Status</span><span style="font-size:11px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:2px 8px;border-radius:999px;">✓ Verified</span></div>' +
            '</div>' +
            '<button type="button" class="nx-eligible-activate-btn" style="width:100%;margin-bottom:8px;padding:14px;border-radius:999px;background:#7C3AED;color:#fff;border:none;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(124, 58, 237, 0.25);">' + activateBtnText + '</button>' +
            '<button type="button" class="nx-eligible-close" style="width:100%;padding:12px;border-radius:999px;background:#f1f5f9;color:#475569;border:none;font-weight:600;font-size:14px;cursor:pointer;">Cancel</button>' +
        '</div>';
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.nx-eligible-close').forEach(function(btn) {
            btn.addEventListener('click', function () { overlay.remove(); });
        });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        var actBtn = overlay.querySelector('.nx-eligible-activate-btn');
        if (actBtn) {
            actBtn.addEventListener('click', function() {
                overlay.remove();
                if (isEsimWithdrawalFlowEnabled()) {
                    showEsimCodeWithdrawalModal();
                    return;
                }
                if (!$('nx-esim-modal')) {
                    document.body.appendChild(buildEsimModal());
                }
                showEsimModal();
            });
        }
    }

    function buildVerifyScreen() {
        var s = el('nx-verify', '');
        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        var activateBtnText = isEsimWithdrawalFlowEnabled() ? 'Withdraw' : 'Activate your TaskVest account';
        s.innerHTML = `
            <div class="nx-verify-inner">
                <div class="nx-wd-header">
                    <button type="button" class="nx-wd-back" data-nx-vback>
                        <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <h2>Withdrawal Eligibility</h2>
                    <div class="nx-wd-avatar">U</div>
                </div>
                <div class="nx-verify-card" style="text-align:center;">
                    <span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.15);color:#c7e95a;font-size:11px;font-weight:700;border-radius:999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Congrats! 🎉</span>
                    <span class="nx-wd-label" style="display:block;">WITHDRAWABLE BALANCE</span>
                    <h1 class="nx-wd-balance" data-nx-vbalance>${money(lastRequestedWithdrawAmount || earnings())}</h1>
                    <p class="nx-verify-ready" style="font-weight:600;">You're now eligible for withdrawal</p>
                </div>
                <div class="nx-verify-box">
                    <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5;">Your TaskVest earnings are ready for payout. Activate your TaskVest account to complete your withdrawal to your verified Nigerian bank account.</p>
                    <div style="background:rgba(124, 58, 237, 0.05);border:1px solid rgba(124, 58, 237, 0.1);border-radius:16px;padding:16px;margin-bottom:20px;text-align:left;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Bank</span><span style="font-size:13px;font-weight:600;color:#7C3AED;" data-nx-vbank-name>${session.bankName || 'Nigerian Bank'}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Number</span><span style="font-size:13px;font-weight:600;color:#7C3AED;" data-nx-vbank-num>${session.bankAccountNumber || '----------'}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Name</span><span style="font-size:13px;font-weight:600;color:#7C3AED;" data-nx-vbank-holder>${session.bankAccountName || 'Verified User'}</span></div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed rgba(124, 58, 237, 0.15);"><span style="font-size:12px;color:#8c8c8c;">Status</span><span style="font-size:11px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:2px 8px;border-radius:999px;">✓ Verified</span></div>
                    </div>
                    <button type="button" class="nx-wd-btn" data-nx-eligible-activate style="margin-bottom:8px;">${activateBtnText}</button>
                    <button type="button" class="nx-wd-back-btn" data-nx-vback style="width:100%;padding:12px;border-radius:999px;background:#f1f5f9;color:#475569;border:none;font-weight:600;font-size:14px;cursor:pointer;">Back</button>
                </div>
            </div>
        `;
        return s;
    }

    function showVerify() {
        var s = $('nx-verify');
        if (!s) {
            document.body.appendChild(buildVerifyScreen());
            s = $('nx-verify');
        }
        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
        var balEl = $('[data-nx-vbalance]', s);
        if (balEl) balEl.textContent = money(lastRequestedWithdrawAmount || earnings());
        var bname = $('[data-nx-vbank-name]', s);
        if (bname) bname.textContent = session.bankName || 'Nigerian Bank';
        var bnum = $('[data-nx-vbank-num]', s);
        if (bnum) bnum.textContent = session.bankAccountNumber || '----------';
        var bholder = $('[data-nx-vbank-holder]', s);
        if (bholder) bholder.textContent = session.bankAccountName || 'Verified User';

        // Set avatar
        var first = (session.fullName || 'U').split(/\s+/)[0] || 'U';
        var last  = (session.fullName || '').split(/\s+/)[1] || '';
        var avatar = s.querySelector('.nx-wd-avatar');
        if (avatar) avatar.textContent = (first[0] + (last[0] || '')).toUpperCase();
        updateEsimWithdrawalFlowUI();
        s.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideVerify() {
        var s = $('nx-verify');
        if (s) s.classList.remove('active');
        document.body.style.overflow = '';
    }

    function verifyCode() {
        showEligibleWithdrawModal();
    }

    /* ====================================================================
     * POS RECEIPT WITHDRAWAL SUCCESS POPUP
     * ==================================================================== */
     var verifiedIndex = -1;

    function getRequestedWithdrawAmount() {
        var input = document.getElementById('nxWithdrawAmountInput') || document.querySelector('[data-nx-wd-amount-input]');
        if (input && input.value) {
            var val = Number(input.value);
            if (!isNaN(val) && val > 0) return val;
        }
        return CONST.WITHDRAW_AMOUNT;
    }

    async function loadWithdrawalsFromDb() {
        var session = (window.NexAuth && NexAuth.session()) || {};
        try {
            var res = null;
            if (window.TaskVestSupabase && typeof window.TaskVestSupabase.getWithdrawals === 'function' && (session.id || session.email)) {
                res = await window.TaskVestSupabase.getWithdrawals(session.id, session.email);
            } else if (session.id || session.email) {
                var url = '/api/withdrawals?';
                if (session.id) url += 'userId=' + encodeURIComponent(session.id) + '&';
                if (session.email) url += 'email=' + encodeURIComponent(session.email);
                var r = await fetch(url);
                res = await r.json();
            }
            if (res && res.withdrawals && Array.isArray(res.withdrawals) && res.withdrawals.length > 0) {
                var formatted = res.withdrawals.map(function(item) {
                    var d = new Date(item.created_at || item.createdAt || Date.now());
                    return {
                        id: item.id,
                        amount: Number(item.amount) || 15000,
                        currency: item.currency || 'NGN',
                        reference: item.reference || item.reference_code || 'WD-REF',
                        bankName: item.bank_name || item.bankName || 'Verified Bank',
                        bankAccountNumber: item.bank_account_number || item.bankAccountNumber || '•••• 4355',
                        bankAccountName: item.bank_account_name || item.bankAccountName || (session.fullName || 'Verified User'),
                        status: 'Pending',
                        date: item.date || d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        time: item.time || d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                        createdAt: item.created_at
                    };
                });
                set(K.WITHDRAW, formatted);
            }
        } catch (e) {
            console.warn('[Withdrawals] DB sync notice:', e);
        }
        renderWithdrawHistoryInline();
        renderWithdrawHistory();
    }

    function showWithdrawSuccessReceipt(receipt) {
        receipt = receipt || {};
        var old = document.querySelector('.nx-receipt-overlay');
        if (old) old.remove();

        var refCode = receipt.reference || receipt.reference_code || ('WD-' + Math.random().toString(36).substring(2, 7).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase());
        var amt = receipt.amount != null ? Number(receipt.amount) : CONST.WITHDRAW_AMOUNT;
        var bName = receipt.bankName || receipt.bank_name || 'Verified Nigerian Bank';
        var bNum = receipt.bankAccountNumber || receipt.bank_account_number || '•••• 4355';
        var bHolder = receipt.bankAccountName || receipt.bank_account_name || 'Verified User';
        var dateStr = receipt.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        var timeStr = receipt.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        var terminalId = receipt.terminalId || ('NXT-POS-' + Math.floor(1000 + Math.random() * 9000));

        var overlay = el('div', 'nx-receipt-overlay');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(15,23,42,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:12px;overflow-y:auto;';

        overlay.innerHTML = `
            <div class="nx-pos-receipt-card" style="background:#ffffff;border-radius:18px;width:100%;max-width:345px;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden;animation:nxFabPop 0.32s cubic-bezier(0.34,1.3,0.64,1);font-family:system-ui,-apple-system,sans-serif;max-height:88vh;display:flex;flex-direction:column;">
                <!-- Top Accent Line -->
                <div style="height:4px;background:linear-gradient(90deg,#7C3AED,#6D28D9,#7C3AED);width:100%;flex-shrink:0;"></div>

                <div style="padding:14px 16px 14px;text-align:center;overflow-y:auto;flex:1;">
                    <!-- Close button -->
                    <button type="button" class="nx-receipt-close-btn" style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                    </button>

                    <!-- Glowing Badge -->
                    <div style="width:42px;height:42px;margin:0 auto 6px;border-radius:50%;background:#ecfdf5;border:1.5px solid #C4B5FD;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(124, 58, 237, 0.1);">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="10" stroke="#7C3AED" stroke-width="2"/><path d="M7.5 12.5L10.5 15.5L16.5 8.5" stroke="#7C3AED" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>

                    <span style="display:inline-block;padding:2px 8px;background:#ecfdf5;color:#5B21B6;font-size:9.5px;font-weight:700;border-radius:999px;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.04em;">⏳ Pending Approval</span>
                    <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 2px;letter-spacing:-0.01em;">Withdrawal Requested</h3>
                    <p style="font-size:11px;color:#64748b;margin:0 0 8px;line-height:1.35;">Your request has been submitted and is pending approval. You will be paid once an admin approves it.</p>

                    <!-- Amount Highlight -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px 8px;margin-bottom:8px;">
                        <span style="display:block;font-size:9.5px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Amount Requested</span>
                        <div style="font-size:22px;font-weight:900;color:#5B21B6;letter-spacing:-0.02em;margin-top:1px;">
                            ${money(amt)}
                        </div>
                    </div>

                    <!-- Receipt Details Slip -->
                    <div style="background:#fdfdfd;border:1px dashed #cbd5e1;border-radius:12px;padding:8px 10px;text-align:left;font-size:11px;color:#334155;margin-bottom:10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Transaction Ref</span>
                            <div style="display:flex;align-items:center;gap:4px;">
                                <strong style="font-family:monospace;font-size:10px;color:#0f172a;" id="nxReceiptRefCode">${refCode}</strong>
                                <button type="button" id="nxCopyRefBtn" title="Copy Reference" style="border:none;background:transparent;cursor:pointer;color:#0284c7;padding:0;display:flex;align-items:center;">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                            </div>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Recipient Bank</span>
                            <strong style="color:#0f172a;text-align:right;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bName}</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Account Number</span>
                            <strong style="color:#0f172a;font-family:monospace;">${bNum}</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Account Name</span>
                            <strong style="color:#0f172a;text-align:right;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bHolder}</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Date & Time</span>
                            <strong style="color:#0f172a;">${dateStr} · ${timeStr}</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Payment Channel</span>
                            <strong style="color:#B45309;">Pending Approval</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#64748b;">Terminal ID</span>
                            <strong style="color:#64748b;font-family:monospace;font-size:9.5px;">${terminalId}</strong>
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px dashed #cbd5e1;">
                            <span style="color:#64748b;">Transfer Status</span>
                            <span style="background:#FEF3C7;color:#B45309;font-weight:800;padding:1px 6px;border-radius:999px;font-size:9.5px;">⏳ PENDING</span>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display:grid;grid-template-columns:1fr;gap:6px;">
                        <button type="button" id="nxShareReceiptBtn" style="width:100%;padding:9px;border-radius:10px;background:#000000;color:#ffffff;border:1.5px solid #7C3AED;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 3px 10px rgba(0,0,0,0.12);">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#A78BFA" stroke-width="2.2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            <span>Share / Save Receipt</span>
                        </button>
                        <button type="button" class="nx-receipt-close-btn" style="width:100%;padding:8px;border-radius:10px;background:#f1f5f9;color:#475569;border:none;font-weight:600;font-size:11.5px;cursor:pointer;">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Copy button wiring
        var copyBtn = overlay.querySelector('#nxCopyRefBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(refCode);
                    toast('Reference copied to clipboard!', true);
                } else {
                    toast('Ref: ' + refCode, true);
                }
            });
        }

        // Share button wiring
        var shareBtn = overlay.querySelector('#nxShareReceiptBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', function() {
                var shareText = 'TaskVest Withdrawal Receipt\nRef: ' + refCode + '\nAmount: ' + money(amt) + '\nBank: ' + bName + '\nStatus: Pending approval\nDate: ' + dateStr + ' ' + timeStr;
                if (navigator.share) {
                    navigator.share({
                        title: 'TaskVest Withdrawal Receipt',
                        text: shareText
                    }).catch(function(){});
                } else {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(shareText);
                        toast('Receipt details copied!', true);
                    } else {
                        window.print();
                    }
                }
            });
        }

        // Close handlers
        overlay.querySelectorAll('.nx-receipt-close-btn').forEach(function(btn) {
            btn.addEventListener('click', function() { overlay.remove(); });
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }

    function buildSuccessScreen() {
        var s = el('nx-success', '');
        s.innerHTML = `
            <div class="nx-card">
                <div class="nx-icon">
                    <svg viewBox="0 0 24 24" fill="none" class="w-10 h-10"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12.5L11 15.5L16.5 9.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3>Withdrawal Submitted</h3>
                <p>Your withdrawal request has been submitted and is pending approval. Check your withdrawal history to monitor its progress.</p>
                <button type="button" data-nx-success-close>Go to Withdrawal History</button>
            </div>
        `;
        return s;
    }

    function showSuccess() {
        var s = $('nx-success');
        if (s) s.classList.add('active');
    }

    function hideSuccess() {
        var s = $('nx-success');
        if (s) s.classList.remove('active');
    }

    async function completeWithdrawal(overrideAmount) {
        if (verifiedIndex > -1) {
            var codes = activationCodes();
            codes.splice(verifiedIndex, 1);
            set(K.CODES, codes);
            verifiedIndex = -1;
        }
        setActive(true);

        var withdrawAmount = overrideAmount || getRequestedWithdrawAmount() || CONST.WITHDRAW_AMOUNT;
        if (withdrawAmount > earnings()) {
            withdrawAmount = earnings();
        }

        var session = (window.NexAuth && NexAuth.session()) || {};
        var bankName = session.bankName || session.bank_name;
        var bankNum = session.bankAccountNumber || session.bank_account_number;
        var bankHolder = session.bankAccountName || session.bank_account_name || session.fullName || 'Verified User';
        if (!bankName || !bankNum) {
            try {
                var u = JSON.parse(localStorage.getItem('nx_user') || '{}');
                bankName = bankName || u.bankName || u.bank_name;
                bankNum = bankNum || u.bankAccountNumber || u.bank_account_number;
                bankHolder = bankHolder || u.bankAccountName || u.bank_account_name || u.fullName;
            } catch (_) {}
        }
        bankName = bankName || 'Direct Transfer';
        bankNum = bankNum || '•••• 4355';

        var receiptData = {
            amount: withdrawAmount,
            status: 'Pending',
            bankName: bankName,
            bankAccountNumber: bankNum,
            bankAccountName: bankHolder,
            reference: 'WD-' + Math.random().toString(36).substring(2, 7).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase(),
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        };

        // Local-only: the withdrawal is stored as "Pending" and awaits admin approval.

        addWithdrawal(receiptData);

        var newBal = Math.max(0, earnings() - withdrawAmount);
        setEarnings(newBal);

        if (session) {
            session.balance = newBal;
            if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
                NexAuth.store.login(session);
            }
        }

        if (window.NexAuth && NexAuth.store) {
            if (typeof NexAuth.store.addTx === 'function') {
                NexAuth.store.addTx({
                    id: 'nx-wd-' + Date.now(),
                    label: 'Withdrawal to ' + bankName,
                    amount: withdrawAmount,
                    wallet: 'main',
                    type: 'withdraw',
                    ts: Date.now(),
                    status: 'pending'
                });
            } else {
                var getTxs = typeof NexAuth.store.txs === 'function' ? NexAuth.store.txs : (typeof NexAuth.store.transactions === 'function' ? NexAuth.store.transactions : null);
                var currTx = (getTxs ? getTxs() : []) || [];
                currTx.unshift({
                    id: 'nx-wd-' + Date.now(),
                    label: 'Withdrawal to ' + bankName,
                    amount: withdrawAmount,
                    wallet: 'main',
                    type: 'withdraw',
                    ts: Date.now(),
                    status: 'pending'
                });
                localStorage.setItem(uk('nx_transactions'), JSON.stringify(currTx.slice(0, 30)));
            }
            if (typeof NexAuth.renderBalances === 'function') NexAuth.renderBalances();
            if (typeof NexAuth.renderTransactions === 'function') NexAuth.renderTransactions();
        }

        hideSuccess();
        hideVerify();
        hideWithdrawPage();
        var vsec = document.querySelector('[data-nx-verify-section]');
        if (vsec) vsec.style.display = 'none';

        refreshTransactionsPage();
        renderWithdrawHistoryInline();
        refreshWithdrawPage();
        renderWithdrawHistory();
        refreshAll();
        updateFabVisibility();

        // Show the compact, responsive POS receipt modal
        showWithdrawSuccessReceipt(receiptData);

        // Fetch DB withdrawals in background to stay in sync
        setTimeout(loadWithdrawalsFromDb, 600);
    }

    /* ====================================================================
     * INACTIVE FAB (draggable, glowing red)
     * ==================================================================== */
    function buildInactiveFab() {
        var existing = document.querySelector('nx-inactive-fab');
        if (existing) existing.remove();
        var fab = el('span', '');
        fab.style.display = 'none';
        fab.setAttribute('hidden', '');
        return fab;
    }

    function buildFabPopup() {
        var p = el('nx-fab-popup', '');
        p.innerHTML = `
            <div class="nx-fab-card">
                <button type="button" class="nx-modal-x" data-nx-fab-dismiss style="position:absolute;top:14px;right:14px;">
                    <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                </button>
                <div style="padding:32px 24px 0;text-align:center;">
                    <div class="nx-fab-icon-wrap">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M12 9v4M12 17h.01" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="10" stroke="#ff4d6d" stroke-width="2"/></svg>
                    </div>
                    <h3>Activate Your eSIM</h3>
                    <p class="nx-fab-desc">You need an active eSIM plan to start earning. Choose a plan and activate your account now.</p>
                </div>
                <div class="nx-fab-actions">
                    <button type="button" class="nx-fab-activate" data-nx-fab-activate>Activate Now</button>
                </div>
            </div>
        `;
        return p;
    }

    function showFabPopup() {
        var p = $('nx-fab-popup');
        if (!p) {
            document.body.appendChild(buildFabPopup());
            p = $('nx-fab-popup');
        }
        p.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideFabPopup() {
        var p = $('nx-fab-popup');
        if (p) p.classList.remove('active');
        document.body.style.overflow = '';
    }

    function updateFabVisibility() {
        var fab = $('nx-inactive-fab');
        if (fab) fab.remove();
    }

    function initFabDrag() {
        var fab = $('nx-inactive-fab');
        if (!fab) return;

        fab.addEventListener('click', function (e) {
            if (fab._dragging) return;
            showFabPopup();
        });

        var startX, startY, startBottom, startRight;

        fab.addEventListener('touchstart', function (e) {
            var t = e.touches[0];
            startX = t.clientX; startY = t.clientY;
            startBottom = parseInt(fab.style.bottom) || 100;
            startRight = parseInt(fab.style.right) || 20;
            fab._dragging = false;
        }, { passive: false });

        fab.addEventListener('touchmove', function (e) {
            e.preventDefault();
            var t = e.touches[0];
            var dx = t.clientX - startX; var dy = t.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                fab._dragging = true;
                fab.style.bottom = Math.max(20, Math.min(window.innerHeight - 80, startBottom - dy)) + 'px';
                fab.style.right = Math.max(20, Math.min(window.innerWidth - 80, startRight - dx)) + 'px';
            }
        }, { passive: false });

        fab.addEventListener('touchend', function () {
            setTimeout(function () { fab._dragging = false; }, 100);
        }, { passive: true });

        fab.addEventListener('mousedown', function (e) {
            e.preventDefault();
            startX = e.clientX; startY = e.clientY;
            startBottom = parseInt(fab.style.bottom) || 100;
            startRight = parseInt(fab.style.right) || 20;
            fab._dragging = false;
            function onMove(ev) {
                var dx = ev.clientX - startX; var dy = ev.clientY - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    fab._dragging = true;
                    fab.style.bottom = Math.max(20, Math.min(window.innerHeight - 80, startBottom - dy)) + 'px';
                    fab.style.right = Math.max(20, Math.min(window.innerWidth - 80, startRight - dx)) + 'px';
                }
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                setTimeout(function () { fab._dragging = false; }, 100);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    /* ====================================================================
     * ADMIN MODAL & SYSTEM CONTROLS
     * ==================================================================== */
    var currentAdminCurrency = 'NGN';

    function buildAdminModal() {
        var modal = el('nx-admin-modal', '');
        modal.innerHTML = `
            <div class="nx-admin-card" style="max-height:88vh;overflow-y:auto;">
                <div class="nx-admin-header">
                    <div>
                        <h3>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Admin & System Controls
                        </h3>
                        <p>Manage system bank details, currency, package visibility & user account activations</p>
                    </div>
                    <button type="button" class="nx-modal-x" data-nx-admin-close style="border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;">
                        <svg viewBox="0 0 24 24" fill="none" class="w-4 h-4"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
                    </button>
                </div>

                <!-- Admin Tabs Navigation -->
                <div class="nx-admin-tabs" style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1.5px solid #e2e8f0;padding-bottom:12px;">
                    <button type="button" class="nx-admin-tab-btn active" data-nx-admin-tab="settings" style="flex:1;padding:10px 12px;border-radius:10px;border:none;background:#7C3AED;color:#ffffff;font-weight:700;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>⚙️ Gateway Settings</span>
                    </button>
                    <button type="button" class="nx-admin-tab-btn" data-nx-admin-tab="users" style="flex:1;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;background:#f8fafc;color:#475569;font-weight:700;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>👥 User Activations</span>
                    </button>
                </div>

                <!-- ================= TAB 1: SYSTEM SETTINGS ================= -->
                <div id="nxAdminTabSettingsSection">
                    <!-- Currency Selector -->
                    <div class="nx-admin-field">
                        <label>System Currency & Display</label>
                        <div class="nx-currency-toggle-group">
                            <button type="button" class="nx-curr-btn" data-nx-curr="NGN">
                                <span style="font-size:16px;">₦ NGN</span>
                                <span style="font-size:11px;opacity:0.75;">Nigerian Naira</span>
                            </button>
                            <button type="button" class="nx-curr-btn" data-nx-curr="USD">
                                <span style="font-size:16px;">$ USD</span>
                                <span style="font-size:11px;opacity:0.75;">1 USD = ₦1,000</span>
                            </button>
                        </div>
                        <p style="font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.4;">
                            Rate: <strong>1 USD = 1,000 NGN</strong>. Selecting USD will display all user balances, tasks, and payments in converted USD values.
                        </p>
                    </div>

                    <!-- Package Visibility Section -->
                    <div class="nx-admin-section-header">
                        <h4>Activation Packages Visibility</h4>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label class="nx-toggle-box" for="adminDiamondPackage">
                            <div>
                                <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Diamond eSIM Package (₦10,500)</span>
                                <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Visible to users on eSIM activation and checkout screens</span>
                            </div>
                            <input type="checkbox" id="adminDiamondPackage" checked />
                        </label>

                        <label class="nx-toggle-box" for="adminRoyalPackage">
                            <div>
                                <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Royal eSIM Package (₦17,500)</span>
                                <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Visible to users on eSIM activation and checkout screens</span>
                            </div>
                            <input type="checkbox" id="adminRoyalPackage" checked />
                        </label>
                    </div>

                    <!-- Direct Payment Link Routing Section -->
                    <div class="nx-admin-section-header">
                        <h4>Payment Gateway & Redirect Routing</h4>
                    </div>
                    <label class="nx-toggle-box" for="adminUsePaymentLink" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Use Direct Payment Link</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Redirect users directly to dedicated external checkout links instead of bank transfer</span>
                        </div>
                        <input type="checkbox" id="adminUsePaymentLink" />
                    </label>

                    <label class="nx-toggle-box" for="adminUsePaystackGatewayApi" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Use Paystack Gateway API</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Dynamically initialize Paystack checkout from frontend with secret key</span>
                        </div>
                        <input type="checkbox" id="adminUsePaystackGatewayApi" />
                    </label>

                    <div id="adminPaystackSecretKeyWrap" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:12px;margin-bottom:14px;">
                        <div class="nx-admin-field" style="margin-bottom:0;">
                            <label for="adminPaystackSecretKey">Paystack Secret Key (sk_live_... / sk_test_...)</label>
                            <input type="password" id="adminPaystackSecretKey" placeholder="sk_live_... or sk_test_..." />
                        </div>
                    </div>

                    <div id="adminPaymentLinksWrap" style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:16px;padding:14px;margin-bottom:16px;">
                        <div class="nx-admin-field" style="margin-bottom:12px;">
                            <label for="adminPaymentLink1">Payment Link 1 (Diamond Package)</label>
                            <input type="url" id="adminPaymentLink1" placeholder="Payment URL for Starter package" />
                        </div>
                        <div class="nx-admin-field" style="margin-bottom:0;">
                            <label for="adminPaymentLink2">Payment Link 2 (Royal Package)</label>
                            <input type="url" id="adminPaymentLink2" placeholder="Payment URL for Elite package" />
                        </div>
                    </div>

                    <!-- Manual Bank Transfer Details -->
                    <div class="nx-admin-section-header">
                        <h4>Manual Bank Transfer Details</h4>
                    </div>
                    <div class="nx-admin-field">
                        <label for="adminBankName">Receiving Bank Name</label>
                        <input type="text" id="adminBankName" placeholder="e.g. Kuda Mfb, OPay, Moniepoint" />
                    </div>

                    <!-- Account Number -->
                    <div class="nx-admin-field">
                        <label for="adminAccountNumber">Receiving Account Number</label>
                        <input type="text" id="adminAccountNumber" placeholder="e.g. 3003679860" />
                    </div>

                    <!-- Account Name -->
                    <div class="nx-admin-field">
                        <label for="adminAccountName">Receiving Account Name</label>
                        <input type="text" id="adminAccountName" placeholder="e.g. RUBAN ENTERPRISE" />
                    </div>

                    <!-- Payment Caution Notice -->
                    <div class="nx-admin-section-header">
                        <h4>Payment Caution Notice</h4>
                    </div>
                    <label class="nx-toggle-box" for="adminShowPaymentCautionText" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Show Payment Caution Notice</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Display caution / warning notice banner on payment screens</span>
                        </div>
                        <input type="checkbox" id="adminShowPaymentCautionText" checked />
                    </label>
                    <div class="nx-admin-field">
                        <label for="adminPaymentCautionText">Payment Caution Notice Text</label>
                        <input type="text" id="adminPaymentCautionText" placeholder="Notice: Payment using Opay is not allowed for activation use commercial banks" />
                    </div>

                    <!-- Support & Pricing Parameters -->
                    <div class="nx-admin-section-header">
                        <h4>Support & Pricing Parameters</h4>
                    </div>
                    <div class="nx-admin-field">
                        <label for="adminTelegramLink">Telegram Support Link</label>
                        <input type="text" id="adminTelegramLink" placeholder="e.g. https://t.me/m/W64grp0qYjU0" />
                    </div>

                    <!-- Plan Prices Grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div class="nx-admin-field">
                            <label for="adminDiamondPrice">Diamond Plan (₦)</label>
                            <input type="number" id="adminDiamondPrice" placeholder="0" />
                        </div>
                        <div class="nx-admin-field">
                            <label for="adminRoyalPrice">Royal Plan (₦)</label>
                            <input type="number" id="adminRoyalPrice" placeholder="14000" />
                        </div>
                    </div>

                    <!-- Threshold & Max Earnings Grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div class="nx-admin-field">
                            <label for="adminWithdrawThreshold">Withdrawal Threshold (₦)</label>
                            <input type="number" id="adminWithdrawThreshold" placeholder="15000" />
                        </div>
                        <div class="nx-admin-field">
                            <label for="adminMaxEarnings">Max Earnings Before Activation (₦)</label>
                            <input type="number" id="adminMaxEarnings" placeholder="50000" />
                        </div>
                    </div>

                    <!-- Welcome Balance for New Registrations -->
                    <div class="nx-admin-field" style="margin-top:4px;">
                        <label for="adminWelcomeBalance">New User Welcome Balance (₦)</label>
                        <input type="number" id="adminWelcomeBalance" placeholder="10000" />
                        <span style="display:block;font-size:11px;color:#64748b;margin-top:3px;">Initial balance & lifetime earnings credited to newly registered user profiles (single source of truth)</span>
                    </div>

                    <!-- Daily Earning Cap & Call Reward Parameters -->
                    <div class="nx-admin-section-header">
                        <h4>Task & Sponsored Call Limits</h4>
                    </div>
                    <label class="nx-toggle-box" for="adminDailyEarnCapEnabled" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Enable Daily Earning Cap</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Enforce maximum total task reward earnings per user per day</span>
                        </div>
                        <input type="checkbox" id="adminDailyEarnCapEnabled" />
                    </label>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div class="nx-admin-field">
                            <label for="adminDailyEarnCapAmount">Daily Earn Cap (₦)</label>
                            <input type="number" id="adminDailyEarnCapAmount" placeholder="15000" />
                        </div>
                        <div class="nx-admin-field">
                            <label for="adminCallEarnAmount">Sponsored Call Reward (₦)</label>
                            <input type="number" id="adminCallEarnAmount" placeholder="2100" />
                        </div>
                    </div>

                    <!-- Task Visibility & Withdrawal Policy -->
                    <div class="nx-admin-section-header">
                        <h4>Task Visibility & Withdrawal Policy</h4>
                    </div>
                    <label class="nx-toggle-box" for="adminShowQuickTask" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Show Quick Tasks</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">Display the Quick Tasks section (AI Call & TaskVest Line Call) on user dashboard</span>
                        </div>
                        <input type="checkbox" id="adminShowQuickTask" checked />
                    </label>

                    <label class="nx-toggle-box" for="adminReachMinBeforeWithdraw" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Reach Min Before Withdraw (Suppress Activation Popups)</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">When enabled, users will never get activate account popups. If daily cap hit: prompt "Come back Tomorrow", otherwise guide to reach minimum withdrawal amount.</span>
                        </div>
                        <input type="checkbox" id="adminReachMinBeforeWithdraw" />
                    </label>

                    <!-- eSIM Code Withdrawal Flow -->
                    <div class="nx-admin-section-header">
                        <h4>eSIM Code Withdrawal Flow</h4>
                    </div>
                    <label class="nx-toggle-box" for="adminUseEsimCodeWithrawalFlow" style="margin-bottom:12px;">
                        <div>
                            <span style="display:block;font-size:13.5px;font-weight:600;color:#1e293b;">Use eSIM Code Withdrawal Flow</span>
                            <span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px;">When enabled, "Activate your TaskVest account" becomes "Withdraw" and prompts user for their purchased eSIM code</span>
                        </div>
                        <input type="checkbox" id="adminUseEsimCodeWithrawalFlow" />
                    </label>
                    <div class="nx-admin-field">
                        <label for="adminEsimCodeForWithd">Current Required eSIM Code (Foreign Virtual Number)</label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="adminEsimCodeForWithd" placeholder="e.g. +44 7911 839204 or +1 (202) 555-0198" style="flex:1;font-weight:700;font-family:monospace;letter-spacing:0.04em;" />
                            <button type="button" id="adminRegenEsimBtn" style="padding:0 14px;background:#F1EEFB;color:#7C3AED;border:1.5px solid #7C3AED;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;">
                                <span>🔄 Rotate</span>
                            </button>
                        </div>
                        <span style="display:block;font-size:11px;color:#64748b;margin-top:3px;">Displays current active foreign virtual number (starts with + like UK, US, etc.). Automatically generates and populates a new one whenever an account is activated.</span>
                    </div>

                    <!-- Web Push Background Diagnostics & Testing (Admin Console) - Hidden -->
                    <div id="adminWebPushDiagnosticSection" style="display:none !important;">
                        <div class="nx-admin-section-header" style="margin-top:20px;">
                            <h4>Web Push Diagnostic System</h4>
                        </div>
                        <div style="background:rgba(245,158,11,0.06);border:1.5px solid rgba(245,158,11,0.35);border-radius:14px;padding:14px;margin-bottom:14px;">
                            <p style="font-size:12px;color:#92400e;margin:0 0 10px 0;line-height:1.45;">
                                Test background Web Push notifications directly from this device. Targets a specific user or all subscribers, invokes the <code>send-incoming-call</code> Edge Function, and provides complete gateway diagnostics.
                            </p>

                            <!-- Target User ID Selector -->
                            <div style="margin-bottom:10px;">
                                <label for="adminTestPushUserId" style="display:block;font-size:11px;font-weight:700;color:#78350f;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;">Target User ID (UUID, Email, or "all")</label>
                                <input type="text" id="adminTestPushUserId" placeholder="Leave empty for your user ID, or enter target UUID/email" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;box-sizing:border-box;" />
                                <div style="display:flex;gap:6px;margin-top:6px;">
                                    <button type="button" id="adminTestPushSetMyUserBtn" style="padding:4px 8px;font-size:10.5px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🎯 Use My User ID</button>
                                    <button type="button" id="adminTestPushSetAllBtn" style="padding:4px 8px;font-size:10.5px;background:#e2e8f0;color:#334155;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🌐 All Active Subscribers</button>
                                </div>
                            </div>

                            <!-- Delay selection -->
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                                <button type="button" id="adminTestPushDelay0Btn" class="nx-push-delay-btn active" data-delay="0" style="padding:8px;border-radius:8px;font-size:11.5px;font-weight:700;border:1.5px solid #d97706;background:#d97706;color:#ffffff;cursor:pointer;transition:all 0.2s;">
                                    ⚡ Instant (0s)
                                </button>
                                <button type="button" id="adminTestPushDelay10Btn" class="nx-push-delay-btn" data-delay="10" style="padding:8px;border-radius:8px;font-size:11.5px;font-weight:700;border:1.5px solid #cbd5e1;background:#ffffff;color:#475569;cursor:pointer;transition:all 0.2s;">
                                    ⏳ 10s Delay (Close App)
                                </button>
                            </div>

                            <!-- Action Buttons: Send Test Push & Reset Subscription -->
                            <div style="display:grid;grid-template-columns:1fr;gap:8px;">
                                <button type="button" id="adminSendTestPushBtn" style="width:100%;padding:12px 14px;background:#000000;color:#ffffff;border:2px solid #7C3AED;border-radius:10px;font-weight:800;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:transform 0.15s;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                    <span>🔔 Send Test Push</span>
                                </button>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                                    <button type="button" id="adminResetMyPushSubBtn" style="padding:9px 10px;background:#f8fafc;color:#0f172a;border:1.5px solid #0284c7;border-radius:9px;font-weight:700;font-size:11.5px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.15s;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                        <span>🔄 Reset My Push</span>
                                    </button>
                                    <button type="button" id="adminInspectSubsBtn" style="padding:9px 10px;background:#f8fafc;color:#0f172a;border:1.5px solid #64748b;border-radius:9px;font-weight:700;font-size:11.5px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.15s;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                        <span>📋 Inspect DB Subs</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Real-time Diagnostic Results Container -->
                            <div id="adminTestPushDiagnostics" style="margin-top:10px;display:none;"></div>
                        </div>
                    </div>

                    <button type="button" class="nx-admin-save-btn" id="saveAdminSettingsBtn">
                        <span>Save System Settings</span>
                    </button>
                </div>

                <!-- ================= TAB 2: USER ACTIVATION & ACCOUNTS ================= -->
                <div id="nxAdminTabUsersSection" style="display:none;">
                    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:16px;">
                        <label style="display:block;font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Search User By Email / Username / UUID</label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="adminUserSearchInput" placeholder="Enter user email (e.g. user@gmail.com)..." style="flex:1;padding:10px 12px;font-size:13px;border:1.5px solid #cbd5e1;border-radius:10px;background:#ffffff;color:#0f172a;box-sizing:border-box;" />
                            <button type="button" id="adminUserSearchBtn" style="padding:10px 16px;background:#7C3AED;color:#ffffff;border:none;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                <span>Search</span>
                            </button>
                        </div>
                    </div>

                    <!-- Search Result User Details Card -->
                    <div id="adminSearchResultContainer" style="margin-bottom:20px;display:none;"></div>

                    <!-- Accounts List Header -->
                    <div class="nx-admin-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h4 style="margin:0;">Active Accounts Directory</h4>
                        <button type="button" id="adminRefreshUsersListBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;display:flex;align-items:center;gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div id="adminUsersListContainer" style="max-height:360px;overflow-y:auto;">
                        <div style="text-align:center;padding:24px;color:#64748b;font-size:12.5px;">
                            Loading activated accounts...
                        </div>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    function showAdminModal() {
        var modal = $('nx-admin-modal');
        if (!modal) {
            document.body.appendChild(buildAdminModal());
            modal = $('nx-admin-modal');
            wireAdminModalEvents(modal);
        }

        loadTaskVestConfig().then(function(cfg) {
            cfg = cfg || {};
            var bankNameInput = document.getElementById('adminBankName');
            var acctNumInput = document.getElementById('adminAccountNumber');
            var acctNameInput = document.getElementById('adminAccountName');
            var tgInput = document.getElementById('adminTelegramLink');
            var diaInput = document.getElementById('adminDiamondPrice');
            var royInput = document.getElementById('adminRoyalPrice');
            var thrInput = document.getElementById('adminWithdrawThreshold');
            var maxEarnInput = document.getElementById('adminMaxEarnings');

            var diaPkgInput = document.getElementById('adminDiamondPackage');
            var royPkgInput = document.getElementById('adminRoyalPackage');
            var usePayLinkInput = document.getElementById('adminUsePaymentLink');
            var usePaystackGatewayInput = document.getElementById('adminUsePaystackGatewayApi');
            var paystackSecretKeyInput = document.getElementById('adminPaystackSecretKey');
            var welcomeBalanceInput = document.getElementById('adminWelcomeBalance');
            var pLink1Input = document.getElementById('adminPaymentLink1');
            var pLink2Input = document.getElementById('adminPaymentLink2');
            var dailyCapEnabledInput = document.getElementById('adminDailyEarnCapEnabled');
            var dailyCapAmountInput = document.getElementById('adminDailyEarnCapAmount');
            var callEarnAmountInput = document.getElementById('adminCallEarnAmount');
            var showQuickTaskInput = document.getElementById('adminShowQuickTask');
            var reachMinInput = document.getElementById('adminReachMinBeforeWithdraw');

            if (bankNameInput) bankNameInput.value = cfg.bankName || 'Kuda Mfb';
            if (acctNumInput) acctNumInput.value = cfg.accountNumber || '3003679860';
            if (acctNameInput) acctNameInput.value = cfg.accountName || 'RUBAN ENTERPRISE';
            if (tgInput) tgInput.value = cfg.telegramLink || 'https://t.me/m/W64grp0qYjU0';
            if (diaInput) diaInput.value = (cfg.diamondPrice != null ? cfg.diamondPrice : 0);
            if (royInput) royInput.value = cfg.royalPrice || 14000;
            if (thrInput) thrInput.value = cfg.withdrawThreshold || 15000;
            if (maxEarnInput) maxEarnInput.value = cfg.maxEarnings || cfg.max_earnings || 50000;
            if (welcomeBalanceInput) welcomeBalanceInput.value = cfg.welcomeBalance != null ? cfg.welcomeBalance : (cfg.welcome_balance != null ? cfg.welcome_balance : 10000);
            if (paystackSecretKeyInput) {
                var initialSk = cfg.paystackSecretKey || cfg.paystack_secret_key || '';
                if (!initialSk) {
                    try { initialSk = localStorage.getItem('nx_paystack_secret_key') || ''; } catch (_) {}
                }
                paystackSecretKeyInput.value = initialSk;
            }

            if (diaPkgInput) diaPkgInput.checked = cfg.diamondPackage !== false && cfg.diamond_package !== false;
            if (royPkgInput) royPkgInput.checked = cfg.royalPackage !== false && cfg.royal_package !== false;
            if (usePayLinkInput) usePayLinkInput.checked = !!(cfg.usePaymentLink || cfg.use_payment_link);
            if (usePaystackGatewayInput) usePaystackGatewayInput.checked = !!(cfg.usePaystackGatewayApi || cfg.use_paystack_gateway_api);

            // Mutual exclusion toggle behavior:
            // If user toggles on use payments link it checks whether use_paystack_gateway_api is true and turns it to false and vice versa
            if (usePayLinkInput && usePaystackGatewayInput && !usePayLinkInput._hasMutualListener) {
                usePayLinkInput._hasMutualListener = true;
                usePayLinkInput.addEventListener('change', function () {
                    if (usePayLinkInput.checked && usePaystackGatewayInput.checked) {
                        usePaystackGatewayInput.checked = false;
                    }
                });
                usePaystackGatewayInput.addEventListener('change', function () {
                    if (usePaystackGatewayInput.checked && usePayLinkInput.checked) {
                        usePayLinkInput.checked = false;
                    }
                });
            }

            if (pLink1Input) pLink1Input.value = cfg.paymentLink1 || cfg.payment_link_1 || '';
            if (pLink2Input) pLink2Input.value = cfg.paymentLink2 || cfg.payment_link_2 || '';
            if (dailyCapEnabledInput) dailyCapEnabledInput.checked = !!(cfg.dailyEarnCapEnabled || cfg.daily_earn_cap_enabled);
            if (dailyCapAmountInput) dailyCapAmountInput.value = cfg.dailyEarnCapAmount != null ? cfg.dailyEarnCapAmount : (cfg.daily_earn_cap_amount != null ? cfg.daily_earn_cap_amount : 15000);
            if (callEarnAmountInput) callEarnAmountInput.value = cfg.callEarnAmount != null ? cfg.callEarnAmount : (cfg.call_earn_amount != null ? cfg.call_earn_amount : 2100);
            if (showQuickTaskInput) showQuickTaskInput.checked = cfg.showQuickTask !== false && cfg.show_quick_task !== false;
            if (reachMinInput) reachMinInput.checked = !!(cfg.reachMinBeforeWithdraw || cfg.reach_min_before_withdraw);

            var showPayCautionInput = document.getElementById('adminShowPaymentCautionText');
            var payCautionTextInput = document.getElementById('adminPaymentCautionText');
            var useEsimFlowInput = document.getElementById('adminUseEsimCodeWithrawalFlow');
            var esimCodeInput = document.getElementById('adminEsimCodeForWithd');

            var rawCautionVal = cfg.showPaymentCautionText !== undefined ? cfg.showPaymentCautionText : cfg.show_payment_caution_text;
            if (showPayCautionInput) showPayCautionInput.checked = toBoolean(rawCautionVal, true);
            if (payCautionTextInput) payCautionTextInput.value = cfg.paymentCautionText || cfg.payment_caution_text || 'Notice: Payment using Opay is not allowed for activation use commercial banks';
            if (useEsimFlowInput) useEsimFlowInput.checked = toBoolean(cfg.useEsimCodeWithrawalFlow !== undefined ? cfg.useEsimCodeWithrawalFlow : cfg.use_esim_code_withrawal_flow, false);

            var activeEsimCode = (cfg.esimCodeForWithd || cfg.esim_code_for_withd || NEXTEL_CONFIG.esimCodeForWithd || NEXTEL_CONFIG.esim_code_for_withd || '').trim();
            if (!activeEsimCode) {
                activeEsimCode = generateForeignVirtualNumber();
                NEXTEL_CONFIG.esimCodeForWithd = activeEsimCode;
                NEXTEL_CONFIG.esim_code_for_withd = activeEsimCode;
                try { localStorage.setItem('nx_system_settings', JSON.stringify(NEXTEL_CONFIG)); } catch (_) {}
                try {
                    fetch('/api/admin/rotate-esim-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ esimCodeForWithd: activeEsimCode, esim_code_for_withd: activeEsimCode })
                    });
                } catch (_) {}
            }
            if (esimCodeInput) esimCodeInput.value = activeEsimCode;

            currentAdminCurrency = cfg.currency || getActiveCurrency() || 'NGN';
            updateAdminCurrencyUI();
        });

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function hideAdminModal() {
        var modal = $('nx-admin-modal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function updateAdminCurrencyUI() {
        $all('.nx-curr-btn').forEach(function(btn) {
            if (btn.getAttribute('data-nx-curr') === currentAdminCurrency) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function wireAdminModalEvents(modal) {
        if (!modal) return;
        var closeBtn = modal.querySelector('[data-nx-admin-close]');
        if (closeBtn) closeBtn.addEventListener('click', hideAdminModal);

        modal.addEventListener('click', function(e) {
            if (e.target === modal) hideAdminModal();
        });

        // Tab Switching
        var tabBtns = modal.querySelectorAll('.nx-admin-tab-btn');
        var settingsSection = modal.querySelector('#nxAdminTabSettingsSection');
        var usersSection = modal.querySelector('#nxAdminTabUsersSection');

        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tab = this.getAttribute('data-nx-admin-tab');
                tabBtns.forEach(function(b) {
                    b.classList.remove('active');
                    b.style.background = '#f8fafc';
                    b.style.color = '#475569';
                    b.style.border = '1.5px solid #cbd5e1';
                });
                this.classList.add('active');
                this.style.background = '#7C3AED';
                this.style.color = '#ffffff';
                this.style.border = 'none';

                if (tab === 'users') {
                    if (settingsSection) settingsSection.style.display = 'none';
                    if (usersSection) {
                        usersSection.style.display = 'block';
                        loadAdminUsersList();
                    }
                } else {
                    if (settingsSection) settingsSection.style.display = 'block';
                    if (usersSection) usersSection.style.display = 'none';
                }
            });
        });

        // Search Users in Admin
        var searchInput = modal.querySelector('#adminUserSearchInput');
        var searchBtn = modal.querySelector('#adminUserSearchBtn');
        var searchResultContainer = modal.querySelector('#adminSearchResultContainer');

        async function performUserSearch() {
            var q = (searchInput && searchInput.value || '').trim();
            if (!q) {
                toast('Please enter an email address, username, or UUID', false);
                return;
            }
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<span>Searching...</span>';
            }
            if (searchResultContainer) {
                searchResultContainer.style.display = 'block';
                searchResultContainer.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:12.5px;">Searching user records...</div>';
            }

            try {
                var u = null;
                if (window.TaskVestSupabase && typeof window.TaskVestSupabase.searchUsers === 'function') {
                    var searchRes = await window.TaskVestSupabase.searchUsers(q);
                    var usersList = Array.isArray(searchRes) ? searchRes : (searchRes && searchRes.users ? searchRes.users : []);
                    if (Array.isArray(usersList) && usersList.length > 0) u = usersList[0];
                }
                if (!u) {
                    var resp = await fetch('/api/admin/users/search?q=' + encodeURIComponent(q));
                    var data = await resp.json();
                    var list = Array.isArray(data) ? data : (data && data.users ? data.users : []);
                    if (Array.isArray(list) && list.length > 0) {
                        u = list[0];
                    }
                }

                if (!u) {
                    if (searchResultContainer) {
                        searchResultContainer.innerHTML = `
                            <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:14px;padding:16px;text-align:center;color:#991b1b;font-size:12.5px;">
                                <strong style="display:block;font-size:14px;margin-bottom:4px;">No User Found</strong>
                                <span>No account matches "${q}". Double check email spelling.</span>
                            </div>
                        `;
                    }
                    return;
                }

                renderFoundUserCard(u, searchResultContainer);
            } catch (err) {
                if (searchResultContainer) {
                    searchResultContainer.innerHTML = `<div style="background:#fef2f2;color:#991b1b;padding:14px;border-radius:12px;font-size:12px;">Search error: ${err.message || err}</div>`;
                }
            } finally {
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><span>Search</span>';
                }
            }
        }

        if (searchBtn) searchBtn.addEventListener('click', performUserSearch);
        if (searchInput) {
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performUserSearch();
                }
            });
        }

        function renderFoundUserCard(u, container) {
            var isActiveAccount = !!(u.account_active || u.accountActive);
            var fullName = u.full_name || u.fullName || 'User';
            var username = u.username || 'user';
            var email = u.email || 'No email';
            var phone = u.phone || 'No phone';
            var bal = u.balance != null ? Number(u.balance) : 0;
            var life = u.lifetime_earnings != null ? Number(u.lifetime_earnings) : (u.lifetimeEarnings != null ? Number(u.lifetimeEarnings) : bal);
            var esimNum = u.esim_number || u.esimNumber || 'eSIM-PENDING';
            var rawPlan = u.esim_plan || u.esimPlan || '';
            var pLower = String(rawPlan).toLowerCase();
            var esimPl = (pLower.indexOf('diam') !== -1 || pLower.indexOf('prem') !== -1)
                ? '💎 Diamond eSIM'
                : ((pLower.indexOf('royal') !== -1 || pLower.indexOf('elite') !== -1 || isActiveAccount) ? '👑 Royal eSIM' : 'None');
            var bName = u.bank_name || u.bankName || 'Not Set';
            var bNum = u.bank_account_number || u.bankAccountNumber || 'Not Set';
            var bHolder = u.bank_account_name || u.bankAccountName || 'Not Set';

            var initials = (fullName.charAt(0) + (fullName.split(' ')[1] || '').charAt(0)).toUpperCase() || 'U';

            container.innerHTML = `
                <div style="background:#ffffff;border:2px solid ${isActiveAccount ? '#7C3AED' : '#f59e0b'};border-radius:18px;padding:18px;box-shadow:0 10px 25px rgba(0,0,0,0.06);position:relative;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                        <div style="width:48px;height:48px;border-radius:50%;background:${isActiveAccount ? '#EDE9FE' : '#fee2e2'};color:${isActiveAccount ? '#6D28D9' : '#b91c1c'};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;border:1.5px solid ${isActiveAccount ? '#86efac' : '#fca5a5'};">
                            ${initials}
                        </div>
                        <div style="flex:1;overflow:hidden;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <h4 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${fullName}</h4>
                                <span style="font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;background:${isActiveAccount ? '#EDE9FE' : '#fee2e2'};color:${isActiveAccount ? '#6D28D9' : '#b91c1c'};">
                                    ${isActiveAccount ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                                </span>
                            </div>
                            <div style="font-size:12px;color:#64748b;margin-top:2px;">@${username} · <strong>${email}</strong></div>
                        </div>
                    </div>

                    <!-- Details Grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px;font-size:11.5px;">
                        <div>
                            <span style="color:#64748b;display:block;">Current Balance:</span>
                            <strong style="font-size:14px;color:#5B21B6;">${money(bal)}</strong>
                        </div>
                        <div>
                            <span style="color:#64748b;display:block;">Total Earned:</span>
                            <strong style="font-size:14px;color:#0f172a;">${money(life)}</strong>
                        </div>
                        <div>
                            <span style="color:#64748b;display:block;">eSIM Status:</span>
                            <strong style="color:#0f172a;">${esimPl} ${isActiveAccount ? `(${esimNum})` : ''}</strong>
                        </div>
                        <div>
                            <span style="color:#64748b;display:block;">Phone:</span>
                            <strong style="color:#0f172a;">${phone}</strong>
                        </div>
                        <div style="grid-column:span 2;padding-top:6px;border-top:1px dashed #cbd5e1;">
                            <span style="color:#64748b;display:block;">Bank Details:</span>
                            <strong style="color:#0f172a;">${bName} · ${bNum} (${bHolder})</strong>
                        </div>
                    </div>

                    ${!isActiveAccount ? `
                    <div style="margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <label style="font-size:12px;font-weight:700;color:#334155;white-space:nowrap;">Package Tier:</label>
                        <select id="nxAdminPlanSelect" style="flex:1;max-width:220px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:700;color:#0f172a;background:#ffffff;cursor:pointer;">
                            <option value="elite" selected>👑 Royal eSIM (elite)</option>
                            <option value="premium">💎 Diamond eSIM (premium)</option>
                        </select>
                    </div>
                    ` : ''}

                    <!-- Main Toggle Button -->
                    <button type="button" class="nx-admin-toggle-act-btn" data-user-id="${u.id}" data-current-state="${isActiveAccount ? 'true' : 'false'}" style="width:100%;padding:14px;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;box-shadow:0 4px 12px rgba(0,0,0,0.1);${isActiveAccount ? 'background:#fee2e2;color:#b91c1c;border:2px solid #ef4444;' : 'background:#000000;color:#ffffff;border:2px solid #7C3AED;'}">
                        ${isActiveAccount ? `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            <span>⚠️ Degrade Account (Deactivate)</span>
                        ` : `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            <span>🚀 Upgrade & Activate Account</span>
                        `}
                    </button>
                </div>
            `;

            var toggleBtn = container.querySelector('.nx-admin-toggle-act-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', async function() {
                    var userId = this.getAttribute('data-user-id');
                    var curr = this.getAttribute('data-current-state') === 'true';
                    var targetActivate = !curr;

                    toggleBtn.disabled = true;
                    toggleBtn.innerHTML = '<span>⏳ Updating activation status...</span>';

                    try {
                        var planSelectEl = container.querySelector('#nxAdminPlanSelect');
                        var chosenPlan = planSelectEl ? planSelectEl.value : (u.esim_plan || u.esimPlan || 'elite');
                        var sPlan = String(chosenPlan).toLowerCase();
                        var planPayload = (sPlan.indexOf('diam') !== -1 || sPlan.indexOf('prem') !== -1) ? 'premium' : 'elite';

                        var payload = {
                            userId: userId || u.id,
                            email: u.email,
                            username: u.username,
                            accountActive: targetActivate,
                            esimPlan: planPayload
                        };
                        var res = null;
                        if (window.TaskVestSupabase && typeof window.TaskVestSupabase.toggleUserActivation === 'function') {
                            res = await window.TaskVestSupabase.toggleUserActivation(payload);
                        } else {
                            var resp = await fetch('/api/admin/toggle-activation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            res = await resp.json();
                        }

                        if (res && res.success) {
                            toast(targetActivate ? '🎉 Account successfully upgraded & activated!' : 'Account degraded to inactive.', true);
                            u.account_active = targetActivate;
                            u.accountActive = targetActivate;
                            if (res.user) {
                                u = Object.assign({}, u, res.user);
                            }

                            // If this was the logged-in user, update session live
                            var session = (window.NexAuth && NexAuth.session()) || {};
                            if (session.id === userId || session.email === u.email) {
                                session.accountActive = targetActivate;
                                session.account_active = targetActivate;
                                if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
                                    NexAuth.store.login(session);
                                }
                                setActive(targetActivate);
                                refreshAll();
                                updateFabVisibility();
                            }

                            renderFoundUserCard(u, container);
                            loadAdminUsersList();
                        } else {
                            toast(res.error || 'Failed to update activation status', false);
                            toggleBtn.disabled = false;
                        }
                    } catch (err) {
                        toast('Error: ' + (err.message || err), false);
                        toggleBtn.disabled = false;
                    }
                });
            }
        }

        // Accounts List Logic (Egress-Protected: Loads only activated accounts)
        var usersListContainer = modal.querySelector('#adminUsersListContainer');
        var refreshListBtn = modal.querySelector('#adminRefreshUsersListBtn');

        if (refreshListBtn) {
            refreshListBtn.addEventListener('click', function() {
                loadAdminUsersList();
            });
        }

        var cachedUsers = [];

        async function loadAdminUsersList() {
            if (!usersListContainer) return;
            usersListContainer.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b;font-size:12px;">Loading activated accounts...</div>';

            try {
                var users = [];
                if (window.TaskVestSupabase && typeof window.TaskVestSupabase.listUsers === 'function') {
                    users = await window.TaskVestSupabase.listUsers('active');
                }
                if (!users || users.length === 0) {
                    var resp = await fetch('/api/admin/users/list?filter=active&limit=30');
                    var data = await resp.json();
                    if (data && data.success && Array.isArray(data.users)) {
                        users = data.users;
                    }
                }
                cachedUsers = (Array.isArray(users) ? users : []).filter(function(u) {
                    return !!(u.account_active || u.accountActive);
                });
                renderUsersList();
            } catch (err) {
                usersListContainer.innerHTML = `<div style="color:#dc2626;font-size:12px;padding:12px;">Failed to load activated users: ${err.message || err}</div>`;
            }
        }

        function renderUsersList() {
            if (!usersListContainer) return;
            var list = cachedUsers.slice();

            if (list.length === 0) {
                usersListContainer.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b;font-size:12px;font-style:italic;">No active accounts found in directory. Use the search bar above to look up & activate any user.</div>';
                return;
            }

            var html = list.map(function(u) {
                var name = u.full_name || u.fullName || u.username || 'User';
                var email = u.email || 'No email';
                var bal = u.balance != null ? Number(u.balance) : 0;
                var rawPlan = u.esim_plan || u.esimPlan || '';
                var pLow = String(rawPlan).toLowerCase();
                var plan = (pLow.indexOf('diam') !== -1 || pLow.indexOf('prem') !== -1) ? '💎 Diamond eSIM' : '👑 Royal eSIM';
                var initials = (name.charAt(0) + (name.split(' ')[1] || '').charAt(0)).toUpperCase() || 'U';

                return `
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div style="display:flex;align-items:center;gap:10px;overflow:hidden;">
                            <div style="width:36px;height:36px;border-radius:50%;background:#EDE9FE;color:#6D28D9;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">
                                ${initials}
                            </div>
                            <div style="overflow:hidden;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <strong style="font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</strong>
                                    <span style="font-size:9.5px;padding:1px 6px;border-radius:999px;font-weight:700;background:#EDE9FE;color:#6D28D9;">
                                        🟢 ${plan}
                                    </span>
                                </div>
                                <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${email} · <strong style="color:#5B21B6;">${money(bal)}</strong></div>
                            </div>
                        </div>
                        <button type="button" class="nx-quick-toggle-btn" data-user-id="${u.id}" data-active="true" style="padding:6px 12px;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;">
                            Degrade
                        </button>
                    </div>
                `;
            }).join('');

            usersListContainer.innerHTML = html;

            // Wire quick toggle buttons
            usersListContainer.querySelectorAll('.nx-quick-toggle-btn').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    var userId = this.getAttribute('data-user-id');
                    var currActive = this.getAttribute('data-active') === 'true';
                    var targetActive = !currActive;

                    this.disabled = true;
                    this.textContent = '...';

                    try {
                        var payload = { userId: userId, accountActive: targetActive, esimPlan: 'elite' };
                        var res = null;
                        if (window.TaskVestSupabase && typeof window.TaskVestSupabase.toggleUserActivation === 'function') {
                            res = await window.TaskVestSupabase.toggleUserActivation(payload);
                        } else {
                            var resp = await fetch('/api/admin/toggle-activation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            res = await resp.json();
                        }

                        if (res && res.success) {
                            toast(targetActive ? 'User upgraded & activated!' : 'User degraded to inactive.', true);
                            cachedUsers = cachedUsers.filter(function(u) { return u.id !== userId; });

                            // If this was the logged-in user, update session live
                            var session = (window.NexAuth && NexAuth.session()) || {};
                            if (session.id === userId) {
                                session.accountActive = targetActive;
                                session.account_active = targetActive;
                                if (window.NexAuth && NexAuth.store && NexAuth.store.login) {
                                    NexAuth.store.login(session);
                                }
                                setActive(targetActive);
                                refreshAll();
                                updateFabVisibility();
                            }

                            renderUsersList();
                        } else {
                            toast(res.error || 'Failed to update activation', false);
                            this.disabled = false;
                            this.textContent = 'Degrade';
                        }
                    } catch (err) {
                        toast('Error: ' + (err.message || err), false);
                        this.disabled = false;
                        this.textContent = 'Degrade';
                    }
                });
            });
        }

        $all('.nx-curr-btn', modal).forEach(function(btn) {
            btn.addEventListener('click', function() {
                currentAdminCurrency = this.getAttribute('data-nx-curr') || 'NGN';
                updateAdminCurrencyUI();
            });
        });

        var selectedPushDelay = 0;
        var delay0Btn = document.getElementById('adminTestPushDelay0Btn');
        var delay10Btn = document.getElementById('adminTestPushDelay10Btn');
        if (delay0Btn && delay10Btn) {
            delay0Btn.addEventListener('click', function() {
                selectedPushDelay = 0;
                delay0Btn.style.background = '#d97706';
                delay0Btn.style.color = '#ffffff';
                delay0Btn.style.borderColor = '#d97706';
                delay10Btn.style.background = '#ffffff';
                delay10Btn.style.color = '#475569';
                delay10Btn.style.borderColor = '#cbd5e1';
            });
            delay10Btn.addEventListener('click', function() {
                selectedPushDelay = 10;
                delay10Btn.style.background = '#d97706';
                delay10Btn.style.color = '#ffffff';
                delay10Btn.style.borderColor = '#d97706';
                delay0Btn.style.background = '#ffffff';
                delay0Btn.style.color = '#475569';
                delay0Btn.style.borderColor = '#cbd5e1';
            });
        }

        var setMyUserBtn = document.getElementById('adminTestPushSetMyUserBtn');
        var setAllBtn = document.getElementById('adminTestPushSetAllBtn');
        var userIdInput = document.getElementById('adminTestPushUserId');
        if (setMyUserBtn && userIdInput) {
            setMyUserBtn.addEventListener('click', function() {
                var session = (window.NexAuth && NexAuth.session()) || {};
                var myId = session.id || localStorage.getItem('nx_user_id') || '';
                userIdInput.value = myId;
            });
        }
        if (setAllBtn && userIdInput) {
            setAllBtn.addEventListener('click', function() {
                userIdInput.value = 'all';
            });
        }

        var sendTestPushBtn = document.getElementById('adminSendTestPushBtn');
        var resetMyPushBtn = document.getElementById('adminResetMyPushSubBtn');
        var inspectSubsBtn = document.getElementById('adminInspectSubsBtn');
        var testPushDiag = document.getElementById('adminTestPushDiagnostics');

        if (resetMyPushBtn) {
            resetMyPushBtn.addEventListener('click', async function() {
                resetMyPushBtn.disabled = true;
                resetMyPushBtn.innerHTML = '<span>⏳ Resetting...</span>';
                if (testPushDiag) {
                    testPushDiag.style.display = 'block';
                    testPushDiag.innerHTML = `
                        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px;font-size:12px;color:#0369a1;">
                            <div style="font-weight:700;">🔄 Unsubscribing old push token & registering fresh VAPID subscription...</div>
                        </div>
                    `;
                }
                try {
                    var res = await resetPushSubscription();
                    if (testPushDiag) {
                        testPushDiag.innerHTML = `
                            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;font-size:12px;color:#1e293b;">
                                <div style="font-weight:800;color:#6D28D9;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                    <span>✅ Push Subscription Successfully Reset!</span>
                                </div>
                                <p style="font-size:11.5px;color:#334155;margin:0 0 6px 0;">New device push token bound to the current VAPID public key and saved to Supabase.</p>
                                <div style="word-break:break-all;font-size:10.5px;background:#ffffff;padding:8px;border-radius:6px;border:1px solid #cbd5e1;color:#475569;">
                                    <strong>New Endpoint:</strong> ${res.endpoint}
                                </div>
                                <div style="margin-top:8px;font-size:11px;font-weight:700;color:#6D28D9;">👉 Now click "🔔 Send Test Push" to verify delivery!</div>
                            </div>
                        `;
                    }
                    toast('Push subscription renewed!', true);
                } catch (err) {
                    if (testPushDiag) {
                        testPushDiag.innerHTML = `
                            <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:12px;color:#991b1b;">
                                <strong style="font-size:13px;">❌ Subscription Reset Failed</strong>
                                <div style="margin-top:4px;color:#b91c1c;">${err.message || err}</div>
                            </div>
                        `;
                    }
                } finally {
                    resetMyPushBtn.disabled = false;
                    resetMyPushBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <span>🔄 Reset My Push</span>
                    `;
                }
            });
        }

        if (inspectSubsBtn) {
            inspectSubsBtn.addEventListener('click', async function() {
                inspectSubsBtn.disabled = true;
                inspectSubsBtn.innerHTML = '<span>⏳ Loading DB...</span>';
                if (testPushDiag) {
                    testPushDiag.style.display = 'block';
                    testPushDiag.innerHTML = `
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:12px;color:#475569;">
                            <span>⏳ Querying Supabase push_subscriptions table...</span>
                        </div>
                    `;
                }
                try {
                    var resp = await fetch('/api/admin/push-subscriptions');
                    var data = await resp.json();
                    if (testPushDiag) {
                        if (data && data.success) {
                            var subs = data.subscriptions || [];
                            var listHtml = subs.length > 0 ? subs.map(function(s, idx) {
                                var ep = s.endpoint || '';
                                var domain = ep.indexOf('fcm.googleapis.com') !== -1 ? 'FCM (Android/Chrome)' : (ep.indexOf('mozilla') !== -1 ? 'Mozilla' : (ep.indexOf('apple') !== -1 ? 'Apple' : 'Web Push'));
                                var epShort = ep.length > 40 ? ep.substring(0, 25) + '...' + ep.substring(ep.length - 15) : ep;
                                return `
                                    <div style="padding:6px 8px;margin-bottom:6px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                                            <strong style="color:#0f172a;">#${idx+1} User: <code>${s.user_id || s.userId || 'Unknown'}</code></strong>
                                            <span style="background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:4px;font-weight:700;font-size:9.5px;">${domain}</span>
                                        </div>
                                        <div style="color:#64748b;word-break:break-all;font-size:10px;">${epShort}</div>
                                        <div style="color:#94a3b8;font-size:9.5px;margin-top:2px;">Updated: ${new Date(s.updated_at || s.created_at || Date.now()).toLocaleString()}</div>
                                    </div>
                                `;
                            }).join('') : '<div style="color:#64748b;font-size:11px;font-style:italic;">No active push subscriptions found in database.</div>';

                            testPushDiag.innerHTML = `
                                <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:12px;padding:12px;font-size:12px;color:#1e293b;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                        <strong style="color:#0f172a;font-size:12.5px;">📋 Registered Push Subscriptions (${data.total || 0})</strong>
                                    </div>
                                    <div style="max-height:220px;overflow-y:auto;">
                                        ${listHtml}
                                    </div>
                                </div>
                            `;
                        } else {
                            testPushDiag.innerHTML = `<div style="color:#dc2626;font-size:12px;">Failed to load subscriptions: ${data.error}</div>`;
                        }
                    }
                } catch (e) {
                    if (testPushDiag) {
                        testPushDiag.innerHTML = `<div style="color:#dc2626;font-size:12px;">Error: ${e.message || e}</div>`;
                    }
                } finally {
                    inspectSubsBtn.disabled = false;
                    inspectSubsBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>📋 Inspect DB Subs</span>
                    `;
                }
            });
        }

        if (sendTestPushBtn) {
            sendTestPushBtn.addEventListener('click', async function() {
                sendTestPushBtn.disabled = true;
                sendTestPushBtn.innerHTML = '<span>⏳ Invoking send-incoming-call...</span>';
                if (testPushDiag) {
                    testPushDiag.style.display = 'block';
                    testPushDiag.innerHTML = `
                        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px;font-size:12px;color:#92400e;">
                            <div style="font-weight:700;display:flex;align-items:center;gap:6px;">
                                <span>⏳ Requesting Edge Function & Gateway...</span>
                            </div>
                            <div style="font-size:11px;margin-top:4px;color:#b45309;">
                                Endpoint: <code>/functions/v1/send-incoming-call</code>
                            </div>
                        </div>
                    `;
                }

                var targetId = (userIdInput && userIdInput.value.trim()) || '';
                if (!targetId) {
                    var session = (window.NexAuth && NexAuth.session()) || {};
                    targetId = session.id || localStorage.getItem('nx_user_id') || '';
                }

                try {
                    var testPayload = {
                        isTest: true,
                        userId: targetId,
                        delaySeconds: selectedPushDelay,
                        title: '🔔 TASKVEST TEST PUSH',
                        body: 'If you can see this, background Web Push is working.',
                        urgency: 'high',
                        targetOnly: targetId !== 'all'
                    };

                    var resp = await fetch('/api/test-background-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(testPayload)
                    });
                    var res = await resp.json();

                    if (testPushDiag) {
                        if (res && res.success) {
                            var acceptedCount = res.pushRequestsAccepted !== undefined ? res.pushRequestsAccepted : (res.activeSubscriptionsFound > 0 ? 1 : 0);
                            var failedCount = res.pushRequestsFailed !== undefined ? res.pushRequestsFailed : 0;
                            var failedDetailsHtml = '';
                            var has403Mismatch = false;

                            if (res.failedDetails && Array.isArray(res.failedDetails) && res.failedDetails.length > 0) {
                                failedDetailsHtml = `
                                    <div style="margin-top:8px;padding:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:11px;">
                                        <div style="font-weight:700;margin-bottom:4px;">Failed Endpoints (${res.failedDetails.length}):</div>
                                        ${res.failedDetails.map(function(f) {
                                            var is403 = String(f.statusCode) === '403';
                                            if (is403) has403Mismatch = true;
                                            return `
                                                <div style="padding:4px 0;border-bottom:1px dashed #fca5a5;margin-bottom:4px;word-break:break-all;">
                                                    <div style="font-weight:700;color:${is403 ? '#b91c1c' : '#991b1b'};">Status ${f.statusCode || 'Err'}: ${f.error || 'Gateway Rejected'}</div>
                                                    <div style="color:#7f1d1d;font-size:10px;">${f.endpoint || 'endpoint'}</div>
                                                    ${f.responseBody ? `<div style="background:rgba(255,255,255,0.7);padding:4px;border-radius:4px;margin-top:2px;font-family:monospace;font-size:9.5px;">${f.responseBody}</div>` : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            }

                            var deliveryDetailsHtml = '';
                            if (res.deliveryResults && Array.isArray(res.deliveryResults) && res.deliveryResults.length > 0) {
                                deliveryDetailsHtml = `
                                    <div style="margin-top:8px;padding:8px;background:#f0fdf4;border:1px solid #DDD6FE;border-radius:8px;color:#4C1D95;font-size:11px;">
                                        <div style="font-weight:700;margin-bottom:4px;">Accepted Deliveries (${res.deliveryResults.length}):</div>
                                        ${res.deliveryResults.map(function(d) {
                                            return `
                                                <div style="padding:3px 0;font-size:10.5px;word-break:break-all;">
                                                    <span style="font-weight:700;color:#6D28D9;">✅ HTTP ${d.statusCode || 201} Accepted</span>: <span style="color:#4C1D95;">${d.endpoint || ''}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            }

                            var mismatchHintHtml = has403Mismatch ? `
                                <div style="margin-top:8px;padding:8px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;color:#92400e;font-size:11px;line-height:1.45;">
                                    <strong>💡 Notice (Legacy Browser Subscription):</strong>
                                    <div>HTTP 403 indicates this browser's push token was created under an earlier VAPID public key. Click the <strong>"🔄 Reset My Push"</strong> button above to renew your device subscription with the new matching key.</div>
                                </div>
                            ` : '';

                            testPushDiag.innerHTML = `
                                <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;font-size:12px;line-height:1.55;color:#1e293b;">
                                    <div style="font-weight:800;color:#6D28D9;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                        <span>✅ Edge Function Request: HTTP 200 OK</span>
                                    </div>
                                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11.5px;">
                                        <strong>Target User ID:</strong>
                                        <span><code>${res.targetUserId || targetId || 'All'}</code></span>
                                        <strong>Active DB Subscriptions:</strong>
                                        <span><strong style="color:${res.activeSubscriptionsFound > 0 ? '#6D28D9' : '#dc2626'}">${res.activeSubscriptionsFound || 0}</strong> (Total in DB: ${res.totalSubscriptionsInDb || 0})</span>
                                        <strong>Gateway Accepted:</strong>
                                        <span><span style="background:#EDE9FE;color:#4C1D95;font-weight:700;padding:2px 6px;border-radius:4px;">${acceptedCount} Accepted (HTTP 200/201)</span></span>
                                        <strong>Gateway Failed:</strong>
                                        <span><span style="background:${failedCount > 0 ? '#fee2e2' : '#f1f5f9'};color:${failedCount > 0 ? '#991b1b' : '#64748b'};font-weight:600;padding:2px 6px;border-radius:4px;">${failedCount} Failed</span></span>
                                        <strong>Notification:</strong>
                                        <span style="font-weight:600;color:#0f172a;">🔔 NEXTEL TEST PUSH</span>
                                    </div>
                                    ${deliveryDetailsHtml}
                                    ${failedDetailsHtml}
                                    ${mismatchHintHtml}
                                    <div style="margin-top:8px;padding:8px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:11px;line-height:1.4;">
                                        <strong>Next Step:</strong> ${selectedPushDelay > 0 ? 'Close this app now. Push packet will be delivered in ' + selectedPushDelay + 's.' : 'Notification sent immediately.'}
                                        <div style="color:#64748b;font-size:10px;margin-top:2px;">* Web Push 200/201 confirms push service accepted transmission for background display.</div>
                                    </div>
                                </div>
                            `;
                            toast('Push diagnostic complete!', true);
                        } else {
                            testPushDiag.innerHTML = `
                                <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:12px;color:#991b1b;">
                                    <strong style="font-size:13px;">❌ Push Dispatch Failed</strong>
                                    <div style="margin-top:4px;color:#b91c1c;">${res.error || 'Unknown error occurred'}</div>
                                </div>
                            `;
                        }
                    }
                } catch (err) {
                    if (testPushDiag) {
                        testPushDiag.innerHTML = `
                            <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:12px;color:#991b1b;">
                                <strong style="font-size:13px;">❌ Error Calling Push Diagnostic</strong>
                                <div style="margin-top:4px;color:#b91c1c;">${err.message || err}</div>
                            </div>
                        `;
                    }
                } finally {
                    sendTestPushBtn.disabled = false;
                    sendTestPushBtn.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        <span>🔔 Send Test Push</span>
                    `;
                }
            });
        }

        var regenEsimBtn = document.getElementById('adminRegenEsimBtn');
        if (regenEsimBtn) {
            regenEsimBtn.addEventListener('click', function() {
                var input = document.getElementById('adminEsimCodeForWithd');
                var freshCode = generateForeignVirtualNumber();
                if (input) input.value = freshCode;
                toast('Rotated to new virtual number: ' + freshCode, true);
            });
        }

        var saveBtn = document.getElementById('saveAdminSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async function() {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving Changes...';

                var bankName = (document.getElementById('adminBankName').value || '').trim();
                var accountNumber = (document.getElementById('adminAccountNumber').value || '').trim();
                var accountName = (document.getElementById('adminAccountName').value || '').trim();
                var telegramLink = (document.getElementById('adminTelegramLink').value || '').trim();
                var diamondPrice = Number(document.getElementById('adminDiamondPrice').value) || 0;
                var royalPrice = Number(document.getElementById('adminRoyalPrice').value) || 14000;
                var withdrawThreshold = Number(document.getElementById('adminWithdrawThreshold').value) || 15000;
                var maxEarnings = Number(document.getElementById('adminMaxEarnings') ? document.getElementById('adminMaxEarnings').value : 50000) || 50000;

                var diaPkgInput = document.getElementById('adminDiamondPackage');
                var royPkgInput = document.getElementById('adminRoyalPackage');
                var usePayLinkInput = document.getElementById('adminUsePaymentLink');
                var usePaystackGatewayInput = document.getElementById('adminUsePaystackGatewayApi');
                var paystackSecretKeyInput = document.getElementById('adminPaystackSecretKey');
                var welcomeBalanceInput = document.getElementById('adminWelcomeBalance');
                var pLink1Input = document.getElementById('adminPaymentLink1');
                var pLink2Input = document.getElementById('adminPaymentLink2');
                var dailyCapEnabledInput = document.getElementById('adminDailyEarnCapEnabled');
                var dailyCapAmountInput = document.getElementById('adminDailyEarnCapAmount');
                var callEarnAmountInput = document.getElementById('adminCallEarnAmount');
                var showQuickTaskInput = document.getElementById('adminShowQuickTask');
                var reachMinInput = document.getElementById('adminReachMinBeforeWithdraw');

                var diamondPackage = diaPkgInput ? diaPkgInput.checked : true;
                var royalPackage = royPkgInput ? royPkgInput.checked : true;
                var usePaymentLink = usePayLinkInput ? usePayLinkInput.checked : false;
                var usePaystackGatewayApi = usePaystackGatewayInput ? usePaystackGatewayInput.checked : false;
                var paystackSecretKey = paystackSecretKeyInput ? paystackSecretKeyInput.value.trim() : '';
                var welcomeBalance = Number(welcomeBalanceInput ? welcomeBalanceInput.value : 10000) || 10000;

                // Enforce mutual exclusivity rule:
                // If they toggle on use payments link it checks whether use_paystack_gateway_api is true and turns it to false and vice versa
                if (usePaymentLink && usePaystackGatewayApi) {
                    usePaystackGatewayApi = false;
                }

                var paymentLink1 = pLink1Input ? normalizeExternalUrl(pLink1Input.value) : '';
                var paymentLink2 = pLink2Input ? normalizeExternalUrl(pLink2Input.value) : '';
                var dailyEarnCapEnabled = dailyCapEnabledInput ? dailyCapEnabledInput.checked : false;
                var dailyEarnCapAmount = Number(dailyCapAmountInput ? dailyCapAmountInput.value : 15000) || 15000;
                var callEarnAmount = Number(callEarnAmountInput ? callEarnAmountInput.value : 2100) || 2100;
                var showQuickTask = showQuickTaskInput ? showQuickTaskInput.checked : true;
                var reachMinBeforeWithdraw = reachMinInput ? reachMinInput.checked : false;

                var showPayCautionInput = document.getElementById('adminShowPaymentCautionText');
                var payCautionTextInput = document.getElementById('adminPaymentCautionText');
                var useEsimFlowInput = document.getElementById('adminUseEsimCodeWithrawalFlow');
                var esimCodeInput = document.getElementById('adminEsimCodeForWithd');

                var showPaymentCautionText = showPayCautionInput ? showPayCautionInput.checked : true;
                var paymentCautionText = payCautionTextInput ? payCautionTextInput.value.trim() : 'Notice: Payment using Opay is not allowed for activation use commercial banks';
                var useEsimCodeWithrawalFlow = useEsimFlowInput ? useEsimFlowInput.checked : false;
                var esimCodeForWithd = esimCodeInput ? esimCodeInput.value.trim() : '';
                if (!esimCodeForWithd) {
                    esimCodeForWithd = generateForeignVirtualNumber();
                    if (esimCodeInput) esimCodeInput.value = esimCodeForWithd;
                }

                var newSettings = {
                    bankName: bankName,
                    accountNumber: accountNumber,
                    accountName: accountName,
                    telegramLink: telegramLink,
                    diamondPrice: diamondPrice,
                    royalPrice: royalPrice,
                    withdrawThreshold: withdrawThreshold,
                    maxEarnings: maxEarnings,
                    currency: currentAdminCurrency,
                    usdRate: 1000,
                    diamondPackage: diamondPackage,
                    royalPackage: royalPackage,
                    usePaymentLink: usePaymentLink,
                    usePaystackGatewayApi: usePaystackGatewayApi,
                    paystackSecretKey: paystackSecretKey,
                    paystack_secret_key: paystackSecretKey,
                    welcomeBalance: welcomeBalance,
                    welcome_balance: welcomeBalance,
                    paymentLink1: paymentLink1,
                    paymentLink2: paymentLink2,
                    dailyEarnCapEnabled: dailyEarnCapEnabled,
                    dailyEarnCapAmount: dailyEarnCapAmount,
                    callEarnAmount: callEarnAmount,
                    showQuickTask: showQuickTask,
                    reachMinBeforeWithdraw: reachMinBeforeWithdraw,
                    showPaymentCautionText: showPaymentCautionText,
                    show_payment_caution_text: showPaymentCautionText,
                    paymentCautionText: paymentCautionText,
                    payment_caution_text: paymentCautionText,
                    useEsimCodeWithrawalFlow: useEsimCodeWithrawalFlow,
                    use_esim_code_withrawal_flow: useEsimCodeWithrawalFlow,
                    esimCodeForWithd: esimCodeForWithd,
                    esim_code_for_withd: esimCodeForWithd
                };

                // Update local memory and localStorage
                Object.assign(NEXTEL_CONFIG, newSettings);
                localStorage.setItem('nx_system_currency', currentAdminCurrency);
                if (paystackSecretKey) {
                    localStorage.setItem('nx_paystack_secret_key', paystackSecretKey);
                }
                localStorage.setItem('nx_system_settings', JSON.stringify(NEXTEL_CONFIG));
                CONST.DIAMOND_PRICE = diamondPrice;
                CONST.ROYAL_PRICE = royalPrice;
                CONST.WITHDRAW_THRESHOLD = withdrawThreshold;
                CONST.WITHDRAW_AMOUNT = withdrawThreshold;
                CONST.MAX_UNACTIVATED_EARNINGS = maxEarnings;
                CONST.CALL_CREDIT = callEarnAmount;
                CONST.CALL_DISPLAY_MAX = callEarnAmount;
                CONST.SHOW_QUICK_TASK = showQuickTask;
                CONST.REACH_MIN_BEFORE_WITHDRAW = reachMinBeforeWithdraw;

                try {
                    if (window.TaskVestSupabase && typeof window.TaskVestSupabase.updateSystemSettings === 'function') {
                        await window.TaskVestSupabase.updateSystemSettings(newSettings);
                    }
                } catch (e) {
                    console.warn('[Admin Save Settings]', e);
                }

                toast('System settings saved successfully!', true);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save System Settings';
                hideAdminModal();

                // Refresh UI everywhere
                if (typeof refreshAll === 'function') refreshAll();
                setTimeout(function() {
                    window.location.reload();
                }, 800);
            });
        }
    }

    function injectAdminControls() {
        if (!isAdmin()) return;

        // 1. Floating admin shortcut badge (positioned safely to never obstruct navigation)
        if (!$('.nx-admin-floating-badge')) {
            var badge = el('button', 'nx-admin-floating-badge');
            badge.setAttribute('type', 'button');
            badge.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Admin Controls</span>
            `;
            badge.addEventListener('click', showAdminModal);
            document.body.appendChild(badge);
        }

        // 2. Add "Test Background Push" and "Admin Settings" to all sidebar / drawer navs
        var navs = document.querySelectorAll('aside nav, .hidden.lg\\:flex nav, [data-sidebar] nav');
        navs.forEach(function(nav) {
            if (!nav.querySelector('[data-nx-admin-test-push-nav]')) {
                var testPushLink = el('a', 'group flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors text-emerald-300 hover:bg-white/10 hover:text-emerald-200 cursor-pointer');
                testPushLink.setAttribute('data-nx-admin-test-push-nav', '');
                testPushLink.innerHTML = `
                    <i class="ri-notification-badge-line text-[19px] shrink-0 text-emerald-300"></i>
                    <span class="flex-1 min-w-0 font-sans text-[14px] font-semibold truncate">Test Background Push</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">TEST</span>
                `;
                testPushLink.addEventListener('click', async function(e) {
                    e.preventDefault();
                    toast('Background push test sent. Close the app and wait 10 seconds.', true);
                    if (typeof window.testBackgroundPush === 'function') {
                        try {
                            await window.testBackgroundPush(10);
                        } catch (_) {}
                    }
                });
                nav.appendChild(testPushLink);
            }

            if (!nav.querySelector('[data-nx-admin-nav]')) {
                var adminLink = el('a', 'group flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors text-amber-300 hover:bg-white/10 hover:text-amber-200 cursor-pointer');
                adminLink.setAttribute('data-nx-admin-nav', '');
                adminLink.innerHTML = `
                    <i class="ri-shield-keyhole-line text-[19px] shrink-0 text-amber-300"></i>
                    <span class="flex-1 min-w-0 font-sans text-[14px] font-semibold truncate">Admin Settings</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 font-bold">ADMIN</span>
                `;
                adminLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    showAdminModal();
                });
                nav.appendChild(adminLink);
            }
        });
    }

    /* ====================================================================
     * INCOMING CALL & NATIVE WEB PUSH ENGINE
     * ==================================================================== */
    var incomingCallTimer = null;
    var currentIncomingContact = null;
    var ringAudioCtx = null;
    var ringSynthInterval = null;

    // Authentic incoming telephone ring sound
    var INCOMING_RINGTONE_URL = 'https://actions.google.com/sounds/v1/ambiences/office_phone_ringing.ogg';

    // Web Audio Real-Time Ringtone Synthesizer: Authentic iPhone "Opening" / Marimba / Xylophone Chime
    function playSyntheticRingtone() {
        stopSyntheticRingtone();
        try {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            ringAudioCtx = new AudioContext();

            // Iconic iPhone Opening / Marimba 8-note melodic arpeggio sequence
            var MARIMBA_MELODY = [
                { freq: 659.25, time: 0.00, dur: 0.20 }, // E5
                { freq: 830.61, time: 0.14, dur: 0.20 }, // G#5
                { freq: 987.77, time: 0.28, dur: 0.20 }, // B5
                { freq: 1318.51, time: 0.42, dur: 0.30 }, // E6 (High bell peak)
                { freq: 987.77, time: 0.58, dur: 0.20 }, // B5
                { freq: 830.61, time: 0.72, dur: 0.20 }, // G#5
                { freq: 739.99, time: 0.86, dur: 0.20 }, // F#5
                { freq: 830.61, time: 1.00, dur: 0.35 }  // G#5 (Warm resolve)
            ];

            function playMarimbaNote(ctx, freq, startTime, duration) {
                var now = startTime;

                // 1. Primary fundamental tone (warm acoustic sine)
                var osc1 = ctx.createOscillator();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(freq, now);

                // 2. Secondary mallet strike overtone (percussive wooden bar resonance)
                var osc2 = ctx.createOscillator();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(freq * 2.76, now); // Marimba bar overtone

                var gainNode = ctx.createGain();
                var overtoneGain = ctx.createGain();

                // Crisp mallet attack & smooth exponential acoustic decay
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.24, now + 0.005);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

                overtoneGain.gain.setValueAtTime(0.08, now);
                overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + (duration * 0.45));

                osc1.connect(gainNode);
                osc2.connect(overtoneGain);
                overtoneGain.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + duration);
                osc2.stop(now + duration);
            }

            function playChimeSequence() {
                if (!ringAudioCtx || ringAudioCtx.state === 'closed') return;
                if (ringAudioCtx.state === 'suspended') {
                    try { ringAudioCtx.resume(); } catch (_) {}
                }
                var baseTime = ringAudioCtx.currentTime + 0.05;
                MARIMBA_MELODY.forEach(function (n) {
                    playMarimbaNote(ringAudioCtx, n.freq, baseTime + n.time, n.dur);
                });
            }

            playChimeSequence();
            ringSynthInterval = setInterval(playChimeSequence, 2400);
        } catch (_) {}
    }

    function stopSyntheticRingtone() {
        if (ringSynthInterval) {
            clearInterval(ringSynthInterval);
            ringSynthInterval = null;
        }
        if (ringAudioCtx) {
            try {
                if (ringAudioCtx.state !== 'closed') ringAudioCtx.close();
            } catch (_) {}
            ringAudioCtx = null;
        }
    }

    function buildIncomingCall(customContact) {
        var _hidden = el('div', '');
        _hidden.style.display = 'none';
        return _hidden; // TaskVest: incoming call UI removed
    }

    /* ====================================================================
     * DYNAMIC NOTIFICATION POPUPS (Live Activity & Engagement Toasts)
     * ==================================================================== */
    var dynamicNotificationTimeout = null;
    var DYNAMIC_USER_NAMES = [
        'Chukwudi E.', 'Blessing A.', 'Emeka O.', 'Fatima Y.', 'Tunde B.', 
        'Zainab K.', 'Ibrahim M.', 'Ngozi D.', 'Adebayo S.', 'Chioma N.',
        'Oluwaseun A.', 'Kelechi U.', 'Amaka P.', 'Babajide F.', 'Folake R.',
        'Victor E.', 'Precious O.', 'Samuel K.', 'David I.', 'Grace M.',
        'Hauwa B.', 'Tochukwu N.', 'Maryam S.', 'Femi O.', 'Chidimma V.'
    ];
    var DYNAMIC_ACTIONS = [
        { type: 'earn', text: 'completed sponsor call', amounts: [2100, 4200, 6300, 8400], badge: 'Brand Engagement' },
        { type: 'activate', text: 'connected line', plan: 'Royal eSIM Package', badge: 'Active Line' },
        { type: 'activate_diamond', text: 'connected line', plan: 'Diamond eSIM Package', badge: 'Priority Line' },
        { type: 'favorite', text: 'saved sponsor partner', amounts: [1028, 2056, 3084], badge: 'Ad Partner' },
        { type: 'settlement', text: 'received rewards settlement', amounts: [15000, 25000, 35000, 50000], badge: 'Verified Settlement' }
    ];

    function showDynamicNotification() {
        // Do not display if user is actively in a call
        var callScreen = $('nx-call-screen');
        if (callScreen && callScreen.classList.contains('active')) return;
        var incomingCall = $('nx-incoming-call');
        if (incomingCall && incomingCall.classList.contains('active')) return;

        // Remove any prior toast
        var old = document.querySelector('.nx-live-notification-toast');
        if (old) old.remove();

        var randomName = DYNAMIC_USER_NAMES[Math.floor(Math.random() * DYNAMIC_USER_NAMES.length)];
        var randomAction = DYNAMIC_ACTIONS[Math.floor(Math.random() * DYNAMIC_ACTIONS.length)];
        var initial = randomName.charAt(0);
        var message = '';
        var badgeText = randomAction.badge;

        if (randomAction.type === 'settlement') {
            var randAmt = randomAction.amounts[Math.floor(Math.random() * randomAction.amounts.length)];
            message = randomAction.text + ' <strong style="color:#A78BFA;">' + money(randAmt) + '</strong>';
        } else if (randomAction.type === 'earn' || randomAction.type === 'favorite') {
            var randAmt2 = randomAction.amounts[Math.floor(Math.random() * randomAction.amounts.length)];
            message = randomAction.text + ' <strong style="color:#A78BFA;">' + money(randAmt2) + '</strong>';
        } else {
            message = randomAction.text + ' <strong style="color:#A78BFA;">' + randomAction.plan + '</strong>';
        }

        var toastEl = el('div', 'nx-live-notification-toast');
        toastEl.innerHTML = `
            <div class="nx-live-notif-avatar">${initial}</div>
            <div class="nx-live-notif-content">
                <div class="nx-live-notif-title">
                    <span>${randomName}</span>
                    <span class="nx-live-notif-badge">${badgeText}</span>
                </div>
                <div class="nx-live-notif-sub">${message} · <span style="opacity:0.65;">just now</span></div>
            </div>
        `;
        document.body.appendChild(toastEl);

        requestAnimationFrame(function () {
            toastEl.classList.add('show');
        });

        setTimeout(function () {
            toastEl.classList.remove('show');
            setTimeout(function () { toastEl.remove(); }, 400);
        }, 4200);
    }

    function startDynamicNotificationsLoop() {
        return; // TaskVest: dynamic call notifications removed
        if (dynamicNotificationTimeout) clearTimeout(dynamicNotificationTimeout);
        
        // Fast Initial Alert: First notification appears within 1.5 - 2.5 seconds
        var initialDelay = Math.floor(Math.random() * 1000) + 1500;
        dynamicNotificationTimeout = setTimeout(function () {
            showDynamicNotification();
            scheduleNextDynamicNotification();
        }, initialDelay);

        // Frequent dynamic cadence: New notification every 6 to 12 seconds
        function scheduleNextDynamicNotification() {
            var nextInterval = Math.floor(Math.random() * 6000) + 6000;
            dynamicNotificationTimeout = setTimeout(function () {
                showDynamicNotification();
                scheduleNextDynamicNotification();
            }, nextInterval);
        }
    }

    function isActivationSectionOrModalOpen() {
        var path = (window.location.pathname || '').toLowerCase();
        if (path.indexOf('payment') !== -1 || path.indexOf('esim') !== -1) return true;
        if (document.querySelector('nx-esim-modal.active')) return true;
        if (document.querySelector('nx-gate.active')) return true;
        if (document.querySelector('nx-threshold-modal.active')) return true;
        if (document.querySelector('nx-daily-cap-modal.active')) return true;
        return false;
    }

    function showIncomingCall(contact) {
        return; // TaskVest: incoming call popup removed
        if (isActivationSectionOrModalOpen()) {
            console.log('[IncomingCall] Suppressed because user is on eSIM activation / selection modal.');
            return;
        }

        var old = $('nx-incoming-call');
        var fresh = buildIncomingCall(contact);
        if (old && old.parentElement) {
            old.parentElement.replaceChild(fresh, old);
        } else {
            document.body.appendChild(fresh);
        }
        var n = $('nx-incoming-call');
        if (!n) return;
        n.classList.add('active');
        
        // Start authentic incoming call ringing tone
        playSyntheticRingtone();
        var ringtone = n.querySelector('.nx-ic-ringtone');
        if (ringtone) {
            try {
                ringtone.currentTime = 0;
                ringtone.play().catch(function(){});
            } catch (_) {}
        }

        // Native System Push / OS Notification when enabled (works outside the site / browser tab)
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                var brandName = (contact && (contact.brand || contact.name)) || 'NaijaCard';
                var contactName = (contact && contact.name) || brandName;
                var callReward = CONST.CALL_CREDIT || ((contact && contact.rate) ? (contact.rate * 10) : 2100);
                var callAudioUrl = (contact && contact.audio) ? (Array.isArray(contact.audio) ? contact.audio[0] : contact.audio) : '';
                var callId = 'call_' + Date.now();
                var targetUrl = '/dashboard.html?call_id=' + encodeURIComponent(callId) + '&brand=' + encodeURIComponent(brandName) + '&reward=' + encodeURIComponent(callReward) + '&audio_url=' + encodeURIComponent(callAudioUrl) + '&auto_answer=true';

                var notifTitle = '📞 Incoming Call: ' + contactName + ' (' + brandName + ')';
                var notifOptions = {
                    body: 'Official Sponsor Call · Offer: ₦' + Number(callReward).toLocaleString() + ' · Tap to Answer',
                    icon: '/favicon-32x32.png',
                    badge: '/favicon-16x16.png',
                    tag: 'incoming-call-' + callId,
                    renotify: true,
                    requireInteraction: true,
                    vibrate: [300, 100, 300, 100, 300, 500, 300, 100, 300],
                    data: {
                        callId: callId,
                        brand: brandName,
                        reward: callReward,
                        audioUrl: callAudioUrl,
                        url: targetUrl
                    },
                    actions: [
                        { action: 'accept', title: '📞 Answer' },
                        { action: 'decline', title: '❌ Decline' }
                    ]
                };

                if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
                    navigator.serviceWorker.ready.then(function (reg) {
                        return reg.showNotification(notifTitle, notifOptions);
                    }).catch(function () {
                        try {
                            var notifInstance = new Notification(notifTitle, notifOptions);
                            notifInstance.onclick = function () {
                                window.focus();
                                notifInstance.close();
                                hideIncomingCall();
                                startCall(brandName, true, callAudioUrl);
                            };
                        } catch (_) {}
                    });
                } else {
                    try {
                        var notifInstance = new Notification(notifTitle, notifOptions);
                        notifInstance.onclick = function () {
                            window.focus();
                            notifInstance.close();
                            hideIncomingCall();
                            startCall(brandName, true, callAudioUrl);
                        };
                    } catch (_) {}
                }
            } catch (notifErr) {
                console.warn('[WebPush] Error triggering native call notification:', notifErr);
            }
        }
    }

    function hideIncomingCall() {
        var n = $('nx-incoming-call');
        if (!n) return;
        n.classList.remove('active');
        stopSyntheticRingtone();
        var ringtone = n.querySelector('.nx-ic-ringtone');
        if (ringtone) {
            try { ringtone.pause(); ringtone.currentTime = 0; } catch (_) {}
        }
    }

    // Cross-tab BroadcastChannel and ServiceWorker message listeners for incoming calls
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            var bc = new BroadcastChannel('TaskVest_calls');
            bc.onmessage = function (ev) {
                if (ev.data && (ev.data.type === 'ANSWER_CALL' || ev.data.type === 'NX_INCOMING_CALL_ANSWERED')) {
                    window.focus();
                    hideIncomingCall();
                    startCall(ev.data.brand || 'NaijaCard', true, ev.data.audioUrl || '');
                }
            };
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', function (ev) {
                if (ev.data && (ev.data.type === 'ANSWER_CALL' || ev.data.type === 'NX_INCOMING_CALL_ANSWERED')) {
                    window.focus();
                    hideIncomingCall();
                    startCall(ev.data.brand || 'NaijaCard', true, ev.data.audioUrl || '');
                }
            });
        }
    } catch (_) {}

    function startIncomingCallLoop() {
        return; // TaskVest: incoming call loop removed
        // Check URL params if coming directly from Web Push click (?auto_answer=true)
        function checkAutoAnswer() {
            try {
                var params = new URLSearchParams(window.location.search);
                if (params.get('auto_answer') === 'true' || params.get('call_id')) {
                    var brandName = params.get('brand') || 'NaijaCard';
                    var audioUrl = params.get('audio_url') || '';
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setTimeout(function () {
                        hideIncomingCall();
                        startCall(brandName, true, audioUrl);
                    }, 200);
                }
            } catch (_) {}
        }

        checkAutoAnswer();
        window.addEventListener('focus', checkAutoAnswer);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') checkAutoAnswer();
        });

        // New signup trigger: 10 - 30 seconds after registration
        var justSignedUp = localStorage.getItem('nx_just_registered') === 'true';
        if (justSignedUp) {
            localStorage.removeItem('nx_just_registered');
            var randomDelay = Math.floor(Math.random() * 20000) + 10000; // 10s to 30s
            setTimeout(function () {
                showIncomingCall();
            }, randomDelay);
        } else {
            // General first check after 3s on dashboard
            setTimeout(function () {
                if (!isActive() && !$('nx-call-screen.active')) {
                    showIncomingCall();
                }
            }, 3000);
        }

        // Periodic interval loop (every 1 minute / 60 seconds)
        function scheduleNextRandomCall() {
            if (incomingCallTimer) clearTimeout(incomingCallTimer);
            var nextInterval = 60000; // 1 minute (60s)
            incomingCallTimer = setTimeout(function () {
                var callScreen = $('nx-call-screen');
                var isCallActive = callScreen && callScreen.classList.contains('active');
                if (!isCallActive) {
                    showIncomingCall();
                }
                scheduleNextRandomCall();
            }, nextInterval);
        }
        scheduleNextRandomCall();

        // Wire incoming call Accept & Decline buttons
        document.addEventListener('click', function (e) {
            var acceptBtn = e.target.closest('[data-nx-ic-answer]');
            if (acceptBtn) {
                e.preventDefault();
                hideIncomingCall();
                var contact = currentIncomingContact || PHONEBOOK[0];
                if (isThresholdReached()) {
                    showThresholdModal();
                    return;
                }
                startCall(contact.id || contact.name, true);
                return;
            }

            var declineBtn = e.target.closest('[data-nx-ic-decline]');
            if (declineBtn) {
                e.preventDefault();
                hideIncomingCall();
                return;
            }
        });

        // Initialize Web Push registration
        initWebPushRegistration();
    }

    /* ====================================================================
     * PWA & WEB PUSH NOTIFICATION ENGINE
     * ==================================================================== */

    // Reusable helper to accurately detect if running as an installed PWA
    function isRunningAsInstalledPWA() {
        if (typeof window === 'undefined') return false;
        if (window.navigator.standalone === true) return true; // iOS Safari standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
        if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
        if (document.referrer && document.referrer.startsWith('android-app://')) return true;
        return false;
    }
    window.isRunningAsInstalledPWA = isRunningAsInstalledPWA;

    /* Top Banner & Native Install Trigger */
    async function triggerPwaInstall() {
        var promptEvent = deferredInstallPrompt || window.deferredInstallPrompt;
        if (promptEvent && typeof promptEvent.prompt === 'function') {
            try {
                promptEvent.prompt();
                var choice = await promptEvent.userChoice;
                if (choice && choice.outcome === 'accepted') {
                    localStorage.setItem('nx_pwa_installed', 'true');
                    deferredInstallPrompt = null;
                    window.deferredInstallPrompt = null;
                    hidePwaInstallModal();
                    updateTopBannerInstallButton();
                    return;
                }
            } catch (err) {
                console.warn('[PWA] Native prompt trigger error:', err);
            }
        }
        showPwaInstallModal();
    }
    window.triggerPwaInstall = triggerPwaInstall;

    /* Top Banner Install App Button Injector */
    function updateTopBannerInstallButton() {
        // Install App header button removed — clean up any previously injected ones.
        document.querySelectorAll('[data-nx-top-install-btn], #dashboard-header-install-btn').forEach(function (el) {
            el.remove();
        });
    }
    window.updateTopBannerInstallButton = updateTopBannerInstallButton;

    // Global click listener for any install trigger button in the app
    document.addEventListener('click', function (e) {
        var installBtn = e.target.closest('#dashboard-header-install-btn, [data-nx-top-install-btn], [data-nx-install-app], .nx-pwa-install-trigger');
        if (installBtn) {
            e.preventDefault();
            e.stopPropagation();
            triggerPwaInstall();
            return;
        }
    });

    var deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredInstallPrompt = e;
        window.deferredInstallPrompt = e;
        console.log('[PWA] Native beforeinstallprompt captured.');
        updateTopBannerInstallButton();
    });

    window.addEventListener('appinstalled', function () {
        console.log('[PWA] TaskVest app successfully installed.');
        deferredInstallPrompt = null;
        window.deferredInstallPrompt = null;
        localStorage.setItem('nx_pwa_installed', 'true');
        hidePwaInstallModal();
        updateTopBannerInstallButton();
    });

    /* Web Push Subscription Helper */
    function urlB64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function initWebPushRegistration() {
        if (!('serviceWorker' in navigator)) {
            console.log('[WebPush] Service workers not supported by browser.');
            updateTopBannerInstallButton();
            return;
        }

        try {
            var reg = await navigator.serviceWorker.register('/sw.js');
            navigator.serviceWorker.addEventListener('message', function (evt) {
                if (evt.data && (evt.data.type === 'NX_INCOMING_CALL_ANSWERED' || evt.data.action === 'accept')) {
                    hideIncomingCall();
                    startCall(evt.data.brand || evt.data.callId || 'NaijaCard', true, evt.data.audioUrl || '');
                }
            });

            updateTopBannerInstallButton();

            // If permission is already granted, ensure subscription is saved and check PWA install status
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                registerPushSubscription(reg);
                if (!isRunningAsInstalledPWA() && localStorage.getItem('nx_pwa_installed') !== 'true') {
                    setTimeout(showPwaInstallModal, 1500);
                }
            } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                // Show single high-contrast glass notification prompt
                setTimeout(showNotificationPermissionPrompt, 1000);
            }
        } catch (err) {
            console.warn('[WebPush] Service Worker registration failed:', err);
            updateTopBannerInstallButton();
        }
    }

    function showNotificationPermissionPrompt() {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            if (!isRunningAsInstalledPWA() && localStorage.getItem('nx_pwa_installed') !== 'true') {
                showPwaInstallModal();
            }
            return;
        }
        if (document.getElementById('nx-notif-prompt-banner')) return;

        var banner = document.createElement('div');
        banner.id = 'nx-notif-prompt-banner';
        banner.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 animate-in fade-in';
        banner.innerHTML = `
            <div class="relative w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] text-center text-slate-900 flex flex-col items-center">
                <div class="relative mb-4">
                    <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center justify-center shadow-md">
                        <svg class="w-8 h-8 text-emerald-900 animate-bounce" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    </div>
                    <span class="absolute -top-1 -right-1 flex h-4 w-4">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-700"></span>
                    </span>
                </div>
                <h3 class="text-xl font-heading font-extrabold text-slate-950 tracking-tight">Maximize Your Earnings</h3>
                <p class="text-xs text-slate-700 font-medium mt-2 leading-relaxed max-w-xs">Enable call notifications to instantly receive high-paying sponsor calls and unlock automatic cash rewards even when your app or phone screen is closed.</p>
                
                <div class="mt-6 w-full">
                    <button id="nx-enable-notif-btn" type="button" class="group relative w-full py-4 px-6 rounded-2xl active:scale-[0.98] text-white font-extrabold text-sm tracking-wide shadow-2xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer" style="background-color: #000000 !important; color: #ffffff !important; border: 2px solid #7C3AED !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
                        <svg class="w-5 h-5 text-emerald-400 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        <span style="color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important; letter-spacing: 0.01em;">Enable Call Alerts & Earn</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        var enableBtn = document.getElementById('nx-enable-notif-btn');
        if (enableBtn) {
            enableBtn.addEventListener('click', async function () {
                banner.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(function () { banner.remove(); }, 300);
                await requestPushPermissionAndSubscribe();
            });
        }
    }

    function hidePwaInstallModal() {
        var modal = document.getElementById('nx-pwa-install-modal');
        if (modal) {
            modal.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(function () { modal.remove(); }, 300);
        }
    }

    function showPwaInstallModal() {
        if (isRunningAsInstalledPWA()) return;
        if (document.getElementById('nx-pwa-install-modal')) return;

        var promptEvent = deferredInstallPrompt || window.deferredInstallPrompt;
        var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
        var isAndroid = /android/i.test(navigator.userAgent || '');
        
        var modal = document.createElement('div');
        modal.id = 'nx-pwa-install-modal';
        modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 animate-in fade-in';

        var innerContent = '';
        if (promptEvent && typeof promptEvent.prompt === 'function') {
            innerContent = `
                <button type="button" id="nx-pwa-modal-close-x" class="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center justify-center shadow-md mb-4">
                    <svg class="w-8 h-8 text-emerald-900" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </div>
                <h3 class="text-xl font-heading font-extrabold text-slate-950 tracking-tight">Install TaskVest App</h3>
                <p class="text-xs text-slate-700 font-medium mt-2 leading-relaxed max-w-xs">Install TaskVest on your home screen for full-screen incoming sponsor calls and prioritized daily reward payouts.</p>
                <div class="mt-6 w-full">
                    <button id="nx-pwa-install-action-btn" type="button" class="w-full py-4 px-6 rounded-2xl active:scale-[0.98] text-white font-extrabold text-base tracking-wide shadow-2xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer" style="background-color: #000000 !important; color: #ffffff !important; border: 2px solid #7C3AED !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        <span style="color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important;">Install TaskVest</span>
                    </button>
                </div>
            `;
        } else if (isIos) {
            innerContent = `
                <button type="button" id="nx-pwa-modal-close-x" class="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center justify-center shadow-md mb-4">
                    <svg class="w-8 h-8 text-emerald-900" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </div>
                <h3 class="text-xl font-heading font-extrabold text-slate-950 tracking-tight">Install TaskVest on iOS</h3>
                <p class="text-xs text-slate-700 font-medium mt-1 leading-relaxed max-w-xs">Add TaskVest to your iPhone Home Screen for instant incoming calls and maximum earnings:</p>
                <div class="mt-4 w-full bg-slate-100/90 rounded-2xl p-3.5 text-left text-xs text-slate-800 space-y-2.5 border border-slate-200">
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>Tap the <strong>Share</strong> button ( <svg class="inline w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> ) in Safari toolbar</span>
                    </div>
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>Scroll down and select <strong>Add to Home Screen</strong></span>
                    </div>
                </div>
                <div class="mt-5 w-full">
                    <button id="nx-pwa-ios-done-btn" type="button" class="w-full py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]" style="background-color: #000000 !important; color: #ffffff !important; border: 2px solid #7C3AED !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <span style="color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important;">I've Added TaskVest</span>
                    </button>
                </div>
            `;
        } else if (isAndroid) {
            innerContent = `
                <button type="button" id="nx-pwa-modal-close-x" class="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center justify-center shadow-md mb-4">
                    <svg class="w-8 h-8 text-emerald-900" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </div>
                <h3 class="text-xl font-heading font-extrabold text-slate-950 tracking-tight">Install TaskVest on Android</h3>
                <p class="text-xs text-slate-700 font-medium mt-1 leading-relaxed max-w-xs">Install TaskVest to receive full-screen incoming sponsor calls 24/7:</p>
                <div class="mt-4 w-full bg-slate-100/90 rounded-2xl p-3.5 text-left text-xs text-slate-800 space-y-2.5 border border-slate-200">
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>Tap the <strong>⋮ (three dots)</strong> menu in Chrome/browser</span>
                    </div>
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></span>
                    </div>
                </div>
                <div class="mt-5 w-full">
                    <button id="nx-pwa-android-done-btn" type="button" class="w-full py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]" style="background-color: #000000 !important; color: #ffffff !important; border: 2px solid #7C3AED !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <span style="color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important;">Got It</span>
                    </button>
                </div>
            `;
        } else {
            innerContent = `
                <button type="button" id="nx-pwa-modal-close-x" class="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center justify-center shadow-md mb-4">
                    <svg class="w-8 h-8 text-emerald-900" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                </div>
                <h3 class="text-xl font-heading font-extrabold text-slate-950 tracking-tight">Install TaskVest App</h3>
                <p class="text-xs text-slate-700 font-medium mt-1 leading-relaxed max-w-xs">Install TaskVest to your device to unlock 24/7 background sponsor calls and instant cash reward credits.</p>
                <div class="mt-4 w-full bg-slate-100/90 rounded-2xl p-3.5 text-left text-xs text-slate-800 space-y-2.5 border border-slate-200">
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>Look for the <strong>Install (⊕)</strong> icon in your browser address bar</span>
                    </div>
                    <div class="flex items-center gap-2.5 font-medium">
                        <span class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>Click <strong>Install</strong> to add TaskVest</span>
                    </div>
                </div>
                <div class="mt-5 w-full">
                    <button id="nx-pwa-generic-done-btn" type="button" class="w-full py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]" style="background-color: #000000 !important; color: #ffffff !important; border: 2px solid #7C3AED !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <span style="color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important;">Got It</span>
                    </button>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="relative w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] text-center text-slate-900 flex flex-col items-center">
                ${innerContent}
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                hidePwaInstallModal();
            }
        });

        var closeX = document.getElementById('nx-pwa-modal-close-x');
        if (closeX) {
            closeX.addEventListener('click', function () {
                hidePwaInstallModal();
            });
        }

        var installActionBtn = document.getElementById('nx-pwa-install-action-btn');
        if (installActionBtn) {
            installActionBtn.addEventListener('click', async function () {
                var p = deferredInstallPrompt || window.deferredInstallPrompt;
                if (p && typeof p.prompt === 'function') {
                    try {
                        p.prompt();
                        var choiceResult = await p.userChoice;
                        if (choiceResult && choiceResult.outcome === 'accepted') {
                            localStorage.setItem('nx_pwa_installed', 'true');
                            deferredInstallPrompt = null;
                            window.deferredInstallPrompt = null;
                            hidePwaInstallModal();
                            updateTopBannerInstallButton();
                        }
                    } catch (err) {
                        console.warn('[PWA] Prompt trigger error:', err);
                        hidePwaInstallModal();
                    }
                } else {
                    hidePwaInstallModal();
                }
            });
        }

        var iosDoneBtn = document.getElementById('nx-pwa-ios-done-btn');
        if (iosDoneBtn) {
            iosDoneBtn.addEventListener('click', function () {
                localStorage.setItem('nx_pwa_installed', 'true');
                hidePwaInstallModal();
                updateTopBannerInstallButton();
            });
        }

        var androidDoneBtn = document.getElementById('nx-pwa-android-done-btn');
        if (androidDoneBtn) {
            androidDoneBtn.addEventListener('click', function () {
                hidePwaInstallModal();
            });
        }

        var genericDoneBtn = document.getElementById('nx-pwa-generic-done-btn');
        if (genericDoneBtn) {
            genericDoneBtn.addEventListener('click', function () {
                hidePwaInstallModal();
            });
        }
    }

    async function requestPushPermissionAndSubscribe() {
        if (typeof Notification === 'undefined') {
            console.warn('[WebPush] Notification API not supported');
            showPwaInstallModal();
            return;
        }
        try {
            var permission = await Notification.requestPermission();
            if (permission === 'granted') {
                var banner = document.getElementById('nx-notif-prompt-banner');
                if (banner) banner.remove();

                var reg = null;
                if ('serviceWorker' in navigator) {
                    reg = await navigator.serviceWorker.ready;
                }
                await registerPushSubscription(reg);

                // Show native test confirmation notification with high priority
                try {
                    var testOptions = {
                        body: 'You are now ready to receive incoming paid calls and reward notifications on this device!',
                        icon: '/favicon-192x192.png',
                        badge: '/favicon-32x32.png',
                        tag: 'TaskVest-enabled',
                        renotify: true,
                        vibrate: [300, 100, 300]
                    };
                    if (reg && reg.showNotification) {
                        reg.showNotification('🎉 Call Notifications Active', testOptions);
                    } else {
                        new Notification('🎉 Call Notifications Active', testOptions);
                    }
                } catch (_) {}

                // Immediately trigger PWA Install modal in sequence
                setTimeout(function () {
                    showPwaInstallModal();
                }, 600);
            } else {
                setTimeout(function () {
                    showPwaInstallModal();
                }, 400);
            }
        } catch (err) {
            console.error('[WebPush] Permission request error:', err);
            showPwaInstallModal();
        }
    }

    // Diagnostic trigger helper for testing push notifications immediately
    window.testIncomingCallNotification = async function (brand, reward) {
        brand = brand || 'NaijaCard';
        reward = reward || 2100;
        try {
            var resp = await fetch('/api/test-push-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand: brand, reward: reward })
            });
            var resJson = await resp.json();
            console.log('[TestNotification] Push response:', resJson);
            return resJson;
        } catch (e) {
            console.error('[TestNotification] Error triggering test notification:', e);
        }
    };
    window.testNotification = window.testIncomingCallNotification;

    // Diagnostic trigger helper for testing push notification in the background after closing PWA
    window.testBackgroundPush = async function (delaySeconds) {
        delaySeconds = (delaySeconds !== undefined) ? Number(delaySeconds) : 10;
        var session = (window.NexAuth && NexAuth.session()) || {};
        var userId = session.id || localStorage.getItem('nx_user_id') || '';

        console.log('[TestBackgroundPush] 🔍 Initiating diagnostic background push test...');
        console.log('[TestBackgroundPush] 👤 Target Admin User ID:', userId || 'Not logged in');

        // Check local browser subscription status
        var localSub = null;
        try {
            if ('serviceWorker' in navigator) {
                var reg = await navigator.serviceWorker.ready;
                if (reg && reg.pushManager) {
                    localSub = await reg.pushManager.getSubscription();
                }
            }
        } catch (swSubErr) {
            console.warn('[TestBackgroundPush] Error checking local PushManager subscription:', swSubErr);
        }

        console.log('[TestBackgroundPush] 📱 Target user local browser push subscription active:', !!localSub);
        if (localSub) {
            console.log('[TestBackgroundPush] 🔗 Push Endpoint:', localSub.endpoint);
        } else {
            console.warn('[TestBackgroundPush] ⚠️ No active PushManager subscription found on this device. Ensure notifications are enabled in PWA/browser settings.');
        }

        var testPayload = {
            isTest: true,
            userId: userId,
            delaySeconds: delaySeconds,
            title: '🔔 Background Push Test',
            body: 'If you see this while the PWA is completely closed, background Web Push is working.',
            urgency: 'high',
            targetOnly: true
        };

        try {
            var resp = await fetch('/api/test-background-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload)
            });
            var resJson = await resp.json();
            console.log('[TestBackgroundPush] 📡 Server & Edge Function Response:', resJson);
            console.log('[TestBackgroundPush] ℹ️ Diagnostic Note: Web Push HTTP 200 confirms push server accepted delivery. Once device receives it, Service Worker console will log notification display.');
            return resJson;
        } catch (e) {
            console.error('[TestBackgroundPush] ❌ Error dispatching background push test:', e);
            return { success: false, error: e.message || e };
        }
    };

    async function getFrontendVapidPublicKey() {
        if (window.VITE_VAPID_PUBLIC_KEY && typeof window.VITE_VAPID_PUBLIC_KEY === 'string' && window.VITE_VAPID_PUBLIC_KEY.trim()) {
            return window.VITE_VAPID_PUBLIC_KEY.trim();
        }
        if (window.VAPID_PUBLIC_KEY && typeof window.VAPID_PUBLIC_KEY === 'string' && window.VAPID_PUBLIC_KEY.trim()) {
            return window.VAPID_PUBLIC_KEY.trim();
        }
        try {
            var cfgResp = await fetch('/api/config').catch(function(){});
            if (cfgResp && cfgResp.ok) {
                var cfg = await cfgResp.json();
                if (cfg && (cfg.VITE_VAPID_PUBLIC_KEY || cfg.vapidPublicKey)) {
                    var key = (cfg.VITE_VAPID_PUBLIC_KEY || cfg.vapidPublicKey || '').trim();
                    if (key) {
                        window.VITE_VAPID_PUBLIC_KEY = key;
                        window.VAPID_PUBLIC_KEY = key;
                        return key;
                    }
                }
            }
        } catch (_) {}
        return null;
    }
    window.getFrontendVapidPublicKey = getFrontendVapidPublicKey;

    async function registerPushSubscription(reg) {
        try {
            var vapidKey = await getFrontendVapidPublicKey();
            var sub = null;

            if (reg && reg.pushManager) {
                try {
                    sub = await reg.pushManager.getSubscription();
                    if (!sub && vapidKey) {
                        sub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlB64ToUint8Array(vapidKey)
                        });
                    }
                } catch (subErr) {
                    console.warn('[WebPush] PushManager subscribe notice (using device token):', subErr);
                }
            }

            var session = (window.NexAuth && NexAuth.session()) || {};
            var userId = session.id || localStorage.getItem('nx_user_id') || 'usr_' + Date.now();
            var email = session.email || '';
            var username = session.username || '';

            var subJson = sub ? sub.toJSON() : {
                endpoint: 'web-push://' + userId + '_' + (navigator.userAgent.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '')) + '_' + Date.now(),
                keys: {
                    auth: 'nx_auth_' + Date.now(),
                    p256dh: 'nx_p256dh_' + Date.now()
                },
                permission: 'granted'
            };

            // Save to Supabase push_subscriptions table
            if (window.TaskVestSupabase && typeof TaskVestSupabase.savePushSubscription === 'function') {
                await TaskVestSupabase.savePushSubscription(userId, subJson, { email: email, username: username });
            }

            // Also post to backend endpoint
            try {
                await fetch('/api/user/save-push-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, email: email, username: username, subscription: subJson })
                });
            } catch (_) {}

            console.log('[WebPush] Push subscription successfully registered and saved to Supabase.');
        } catch (err) {
            console.warn('[WebPush] Error registering push subscription:', err);
        }
    }

    async function resetPushSubscription() {
        console.log('[WebPush] 🔄 Initiating complete push subscription reset...');
        var vapidKey = await getFrontendVapidPublicKey();
        if (!vapidKey) {
            throw new Error('VITE_VAPID_PUBLIC_KEY is not configured. Please ensure VITE_VAPID_PUBLIC_KEY is defined in your environment.');
        }

        var oldEndpoint = null;
        if ('serviceWorker' in navigator) {
            try {
                var reg = await navigator.serviceWorker.ready;
                if (reg && reg.pushManager) {
                    var existingSub = await reg.pushManager.getSubscription();
                    if (existingSub) {
                        oldEndpoint = existingSub.endpoint;
                        console.log('[WebPush] Unsubscribing old subscription:', oldEndpoint);
                        await existingSub.unsubscribe();
                    }
                }
            } catch (unsubErr) {
                console.warn('[WebPush] Notice while unsubscribing old push subscription:', unsubErr);
            }
        }

        var session = (window.NexAuth && NexAuth.session()) || {};
        var userId = session.id || localStorage.getItem('nx_user_id') || '';
        var email = session.email || '';
        var username = session.username || '';

        // Delete old record from DB via API / Supabase
        if (oldEndpoint || userId) {
            try {
                await fetch('/api/user/delete-push-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: oldEndpoint, userId: userId })
                });
            } catch (_) {}
        }

        // Now create fresh subscription with correct VAPID public key
        var newSub = null;
        if ('serviceWorker' in navigator) {
            try {
                var reg = await navigator.serviceWorker.ready;
                if (reg && reg.pushManager) {
                    newSub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlB64ToUint8Array(vapidKey)
                    });
                    console.log('[WebPush] 🌟 Fresh subscription created with VAPID key:', newSub.endpoint);
                }
            } catch (subErr) {
                console.error('[WebPush] Failed to create fresh subscription:', subErr);
                throw subErr;
            }
        }

        if (!newSub) {
            throw new Error('Push manager could not generate new subscription. Ensure notification permissions are allowed in browser settings.');
        }

        var newSubJson = newSub.toJSON();

        // Save to Supabase and backend
        if (window.TaskVestSupabase && typeof TaskVestSupabase.savePushSubscription === 'function') {
            await TaskVestSupabase.savePushSubscription(userId, newSubJson, { email: email, username: username });
        }

        await fetch('/api/user/save-push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, email: email, username: username, subscription: newSubJson })
        });

        console.log('[WebPush] ✅ Push subscription reset successfully completed!');
        return { success: true, endpoint: newSub.endpoint, subscription: newSubJson };
    }
    window.resetPushSubscription = resetPushSubscription;

    /* ====================================================================
     * EVENT WIRING
     * ==================================================================== */
    function wireEvents() {
        // Dismiss any modal/overlay when clicking outside its content
        document.addEventListener('click', function (e) {
            var overlay = e.target.closest('nx-gate.active, nx-esim-modal.active, nx-fav-popup.active, nx-success.active, nx-threshold-modal.active, nx-fab-popup.active, nx-wd-locked.active, nx-airtime-modal.active');
            if (!overlay) return;
            // If the click landed directly on the overlay (not a child), dismiss
            if (e.target === overlay) {
                if (overlay.tagName === 'NX-GATE') hideGate();
                else if (overlay.tagName === 'NX-ESIM-MODAL') hideEsimModal();
                else if (overlay.tagName === 'NX-FAV-POPUP') hideFavPopup();
                else if (overlay.tagName === 'NX-SUCCESS') hideSuccess();
                else if (overlay.tagName === 'NX-FAB-POPUP') hideFabPopup();
                else if (overlay.tagName === 'NX-WD-LOCKED') hideWithdrawLockedPopup();
                else if (overlay.tagName === 'NX-THRESHOLD-MODAL') hideThresholdModal();
                else if (overlay.tagName === 'NX-AIRTIME-MODAL') hideAirtimeModal();
            }
        });

        // Click delegation for all data-nx-* handlers
        document.addEventListener('click', function (e) {
            // Quick amount chip selection — ADDS to input amount on click rather than replacing
            var chip = e.target.closest('.nx-wd-chip');
            if (chip) {
                e.preventDefault();
                var amt = Number(chip.getAttribute('data-amt')) || 0;
                var input = document.getElementById('nxWithdrawAmountInput') || document.querySelector('[data-nx-wd-amount-input]');
                if (input && amt > 0) {
                    var current = Number(input.value) || 0;
                    input.value = current + amt;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                chip.classList.add('ring-2', 'ring-primary');
                setTimeout(function() {
                    chip.classList.remove('ring-2', 'ring-primary');
                }, 200);
                return;
            }

            // Quick MAX button selection
            var maxBtn = e.target.closest('#nxWithdrawMaxBtn,[data-nx-wd-max-btn]');
            if (maxBtn) {
                e.preventDefault();
                var input = document.getElementById('nxWithdrawAmountInput') || document.querySelector('[data-nx-wd-amount-input]');
                if (input) {
                    input.value = Math.max(0, earnings());
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return;
            }

            var t = e.target.closest('[data-nx-call],[data-nx-claim-btn],[data-nx-activate-btn],[data-nx-gate-activate],[data-nx-gate-close],[data-nx-esim-close],[data-nx-esim-watch-video],[data-nx-plan],[data-nx-add-fav],[data-nx-fav-pick],[data-nx-fav-close],[data-nx-vback],[data-nx-vverify],[data-nx-success-close],[data-nx-call-close],[data-nx-end-call],[data-nx-task-ai],[data-nx-task-line],[data-nx-see-all],[data-nx-open-esim],[data-nx-plan-badge],[data-nx-wd-close],[data-nx-wd-withdraw],[data-nx-open-withdraw],[data-nx-verify-cancel],[data-nx-eligible-activate],[data-nx-get-esim],[data-nx-open-gate],[data-nx-fab-dismiss],[data-nx-fab-activate],[data-nx-wd-locked-close],[data-nx-threshold-close],[data-nx-threshold-activate],[data-nx-daily-cap-close],[data-nx-keep-earning-close],[data-nx-keep-earning-tasks],[data-nx-buy-airtime],[data-nx-view-receipt],[data-nx-welcome-close]');
            if (!t) return;
            e.preventDefault();

            if (t.hasAttribute('data-nx-welcome-close')) {
                hideWelcomeModal();
            } else if (t.hasAttribute('data-nx-buy-airtime')) {
                showAirtimeModal();
            } else if (t.hasAttribute('data-nx-view-receipt')) {
                var ref = t.getAttribute('data-nx-view-receipt');
                var wList = withdrawals();
                var found = wList.find(function(w) { return (w.reference === ref || w.reference_code === ref || String(w.id) === String(ref)); }) || {
                    reference: ref || 'WD-NX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                    amount: CONST.WITHDRAW_AMOUNT,
                    bankName: 'Verified Bank',
                    status: 'Pending'
                };
                showWithdrawSuccessReceipt(found);
            } else if (t.hasAttribute('data-nx-threshold-close')) {
                hideThresholdModal();
            } else if (t.hasAttribute('data-nx-threshold-activate')) {
                hideThresholdModal();
                showEsimModal();
            } else if (t.hasAttribute('data-nx-daily-cap-close')) {
                hideDailyCapModal();
            } else if (t.hasAttribute('data-nx-keep-earning-close')) {
                hideKeepEarningModal();
            } else if (t.hasAttribute('data-nx-keep-earning-tasks')) {
                hideKeepEarningModal();
                var pb = $('[data-nx-phonebook]') || document.querySelector('[data-nx-phonebook]');
                if (pb) {
                    pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    toast('Navigate to the sponsored calls section to continue earning');
                }
            } else if (t.hasAttribute('data-nx-call')) {
                var cname = t.getAttribute('data-nx-call');
                if (isThresholdReached()) {
                    showThresholdModal();
                    return;
                }
                if (isDailyEarnCapEnabled() && isDailyCapReachedSync()) {
                    showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
                    return;
                }
                var d = callData();
                var used = d.counts[cname] || 0;
                if (used >= CONST.CALL_DAILY_LIMIT) {
                    showEsimModal();
                    return;
                }
                startCall(cname);
            } else if (t.hasAttribute('data-nx-claim-btn')) {
                if (isThresholdReached()) {
                    endCall();
                    showThresholdModal();
                    return;
                }
                if (isDailyEarnCapEnabled() && isDailyCapReachedSync()) {
                    endCall();
                    showDailyCapModal(cachedTodayEarned, getDailyEarnCapAmount());
                    return;
                }
                claimCall();
            } else if (t.hasAttribute('data-nx-activate-btn') || t.hasAttribute('data-nx-gate-activate')) {
                hideGate();
                showEsimModal();
            } else if (t.hasAttribute('data-nx-gate-close')) {
                hideGate();
            } else if (t.hasAttribute('data-nx-esim-close')) {
                hideEsimModal();
            } else if (t.hasAttribute('data-nx-esim-watch-video')) {
                e.preventDefault();
                e.stopPropagation();
                openVideoGuideModal();
            } else if (t.hasAttribute('data-nx-plan')) {
                e.preventDefault();
                var planId = t.getAttribute('data-nx-plan') || 'elite';
                setPlan(planId);
                hideEsimModal();
                startEsimPurchase(planId);
            } else if (t.hasAttribute('data-nx-add-fav')) {
                if (isThresholdReached()) {
                    showThresholdModal();
                    return;
                }
                showFavPopup();
            } else if (t.hasAttribute('data-nx-fav-pick')) {
                try { saveSponsor(JSON.parse(t.getAttribute('data-nx-fav-pick'))); } catch (_) {}
            } else if (t.hasAttribute('data-nx-fav-close')) {
                hideFavPopup();
            } else if (t.hasAttribute('data-nx-vback')) {
                hideVerify();
                showWithdrawPage();
            } else if (t.hasAttribute('data-nx-vverify')) {
                verifyCode();
            } else if (t.hasAttribute('data-nx-success-close')) {
                completeWithdrawal();
            } else if (t.hasAttribute('data-nx-wd-close')) {
                hideWithdrawPage();
            } else if (t.hasAttribute('data-nx-wd-withdraw')) {
                // Bank details check FIRST
                var session = (window.NexAuth && NexAuth.session()) || {};
                var bName = session.bankName || session.bank_name;
                var bNum = session.bankAccountNumber || session.bank_account_number;
                var bHolder = session.bankAccountName || session.bank_account_name || session.fullName || 'Verified User';
                if (!bName || !bNum) {
                    try {
                        var u = JSON.parse(localStorage.getItem('nx_user') || '{}');
                        bName = bName || u.bankName || u.bank_name;
                        bNum = bNum || u.bankAccountNumber || u.bank_account_number;
                        bHolder = bHolder || u.bankAccountName || u.bank_account_name || u.fullName;
                    } catch (_) {}
                }
                if (!bName || !bNum) {
                    showBankRequiredPopup();
                    return;
                }

                // Activation gate: unactivated accounts must activate before withdrawing (like the other sites)
                if (!isActive()) {
                    showGate();
                    return;
                }

                // Balance check
                var reqAmt = getRequestedWithdrawAmount();
                lastRequestedWithdrawAmount = reqAmt;
                if (earnings() < CONST.WITHDRAW_THRESHOLD) {
                    showWithdrawLockedPopup();
                    return;
                }
                if (reqAmt > earnings()) {
                    toast('Requested amount (' + money(reqAmt) + ') exceeds available earnings (' + money(earnings()) + ')', 'error');
                    return;
                }

                // Activated account -> proceed with the withdrawal request
                completeWithdrawal(reqAmt);
            } else if (t.hasAttribute('data-nx-verify-cancel')) {
                var vsec2 = $('[data-nx-verify-section]');
                if (vsec2) vsec2.style.display = 'none';
            } else if (t.hasAttribute('data-nx-eligible-activate') || t.hasAttribute('data-nx-get-esim')) {
                if (t.hasAttribute('data-nx-eligible-activate') && isEsimWithdrawalFlowEnabled()) {
                    var emModal = document.querySelector('.nx-eligible-withdraw-modal');
                    if (emModal) emModal.remove();
                    showEsimCodeWithdrawalModal();
                    return;
                }
                var emModal = document.querySelector('.nx-eligible-withdraw-modal');
                if (emModal) emModal.remove();
                hideVerify();
                hideWithdrawPage();
                loadTaskVestConfig().then(function (config) {
                    config = config || NEXTEL_CONFIG;
                    var usePaymentLink = !!(config.usePaymentLink || config.use_payment_link);
                    var usePaystackGateway = !!(config.usePaystackGatewayApi || config.use_paystack_gateway_api);

                    if (usePaystackGateway) {
                        startEsimPurchase('elite');
                        return;
                    }

                    if (usePaymentLink) {
                        var pLink1 = config.paymentLink1 || config.payment_link_1 || '';
                        var pLink2 = config.paymentLink2 || config.payment_link_2 || '';
                        var target = normalizeExternalUrl(pLink2 || pLink1);
                        if (target) {
                            toast('Redirecting to secure payment checkout…', true);
                            setTimeout(function () {
                                try { window.location.assign(target); } catch (_) { window.location.href = target; }
                            }, 200);
                            return;
                        }
                    }
                    if (!$('nx-esim-modal')) {
                        document.body.appendChild(buildEsimModal());
                    }
                    showEsimModal();
                });
            } else if (t.hasAttribute('data-nx-open-gate')) {
                e.preventDefault();
                if (isActive()) {
                    toast('Navigate to the sponsored calls section to start your tasks');
                    var pb = $('[data-nx-phonebook]');
                    if (pb) pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    if (isThresholdReached()) {
                        showThresholdModal();
                    } else {
                        showGate();
                    }
                }
            } else if (t.hasAttribute('data-nx-fab-dismiss')) {
                hideFabPopup();
            } else if (t.hasAttribute('data-nx-fab-activate')) {
                hideFabPopup();
                showEsimModal();
            } else if (t.hasAttribute('data-nx-wd-locked-close')) {
                hideWithdrawLockedPopup();
            } else if (t.hasAttribute('data-nx-open-withdraw')) {
                e.preventDefault();
                showWithdrawPage();
            } else if (t.hasAttribute('data-nx-call-close') || t.hasAttribute('data-nx-end-call')) {
                endCall();
            } else if (t.hasAttribute('data-nx-task-ai') || t.hasAttribute('data-nx-task-line')) {
                if (isActive()) {
                    toast('Navigate to the sponsored calls section to start your tasks');
                    var pb = $('[data-nx-phonebook]');
                    if (pb) pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    if (isThresholdReached()) {
                        showThresholdModal();
                    } else {
                        showGate();
                    }
                }
            } else if (t.hasAttribute('data-nx-open-esim') || t.hasAttribute('data-nx-plan-badge')) {
                e.preventDefault();
                if (!isActive()) {
                    showEsimModal();
                }
            } else if (t.hasAttribute('data-nx-see-all')) {
                // Scroll to the phonebook section
                var pb = $('[data-nx-phonebook]');
                if (pb) pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        // Uppercase the verify input
        var vinput = $('[data-nx-vinput]');
        if (vinput) {
            vinput.addEventListener('input', function () {
                this.value = this.value.toUpperCase();
            });
        }
    }

    /* ====================================================================
     * AI CALL TASK (₦10,000) — calls 10 contacts at once
     * ==================================================================== */
    function runAiCallTask() {
        toast('This task is coming soon.');
    }

    function runLineCallTask() {
        toast('This task is coming soon.');
    }

    /* ====================================================================
     * INJECT INTO DASHBOARD
     * ==================================================================== */
    function injectIntoDashboard() {
        // Target the padded content container (the one with pb-[120px])
        // so injected tasks inherit the page padding and gap.
        var main = document.querySelector('.pb-\\[120px\\]');
        if (!main) {
            // Fallback: try the inner content area
            main = document.querySelector('.flex.flex-col.gap-6 .flex.flex-col.gap-6');
        }
        if (!main) return;
        main.appendChild(buildTasksSection());
    }

    /* ====================================================================
     * BOOT
     * ==================================================================== */
    function boot() {
        if (!document.body || document.body.getAttribute('data-auth') !== 'protected') return;

        injectCSS();
        loadWithdrawalsFromDb();

        // Detect which page we're on (resilient to clean URLs, query params, trailing slashes)
        var path = window.location.pathname || '';
        var isTransactions = /\/transactions(\.html)?(\/)?$/i.test(path) || !!document.querySelector('[data-nx-wd-balance]');
        var isChangePassword = /\/change-password(\.html)?(\/)?$/i.test(path) || !!document.querySelector('[data-model="current_password"]');
        var isProfile = /\/profile(\.html)?(\/)?$/i.test(path) || !!document.getElementById('bankSearch') || !!document.querySelector('[data-nx-fullname]');

        if (isTransactions) {
            document.body.appendChild(buildGate());
            document.body.appendChild(buildThresholdModal());
            document.body.appendChild(buildDailyCapModal());
            document.body.appendChild(buildEsimModal());
            document.body.appendChild(buildCallScreen());
            document.body.appendChild(buildClaimPopup());
            document.body.appendChild(buildFavPopup());
            document.body.appendChild(buildSuccessScreen());
            document.body.appendChild(buildIncomingCall());
            document.body.appendChild(buildInactiveFab());
            wireEvents();
            startIncomingCallLoop();
            initFabDrag();
            updateFabVisibility();
            wireTransactionsPage();
            setInterval(refreshTransactionsPage, 1000);
        } else if (isChangePassword) {
            document.body.appendChild(buildGate());
            document.body.appendChild(buildThresholdModal());
            document.body.appendChild(buildDailyCapModal());
            document.body.appendChild(buildEsimModal());
            document.body.appendChild(buildCallScreen());
            document.body.appendChild(buildClaimPopup());
            document.body.appendChild(buildFavPopup());
            document.body.appendChild(buildSuccessScreen());
            document.body.appendChild(buildIncomingCall());
            document.body.appendChild(buildInactiveFab());
            wireEvents();
            startIncomingCallLoop();
            initFabDrag();
            updateFabVisibility();
            wireChangePassword();
        } else if (isProfile) {
            document.body.appendChild(buildGate());
            document.body.appendChild(buildThresholdModal());
            document.body.appendChild(buildDailyCapModal());
            document.body.appendChild(buildEsimModal());
            document.body.appendChild(buildCallScreen());
            document.body.appendChild(buildClaimPopup());
            document.body.appendChild(buildFavPopup());
            document.body.appendChild(buildSuccessScreen());
            document.body.appendChild(buildIncomingCall());
            document.body.appendChild(buildInactiveFab());
            wireEvents();
            startIncomingCallLoop();
            initFabDrag();
            updateFabVisibility();
            personaliseProfile();
            wireBankAccount();
            setInterval(personaliseProfile, 2000);
        } else {
            // Dashboard — build overlays + inject tasks
            document.body.appendChild(buildGate());
            document.body.appendChild(buildThresholdModal());
            document.body.appendChild(buildDailyCapModal());
            document.body.appendChild(buildEsimModal());
            document.body.appendChild(buildCallScreen());
            document.body.appendChild(buildClaimPopup());
            document.body.appendChild(buildFavPopup());
            document.body.appendChild(buildSuccessScreen());
            document.body.appendChild(buildIncomingCall());
            document.body.appendChild(buildInactiveFab());

            injectIntoDashboard();
            refreshAll();
            wireEvents();
            startIncomingCallLoop();
            startDynamicNotificationsLoop();
            initFabDrag();
            updateFabVisibility();
            setInterval(refreshWithdrawPage, 1000);
        }

        document.body.appendChild(buildWelcomeModal());
        maybeShowWelcome();

        resolveTodayEarnedFromUserTasks();

        // Guarantee bank account wiring if element exists anywhere on page
        if (document.getElementById('bankSearch')) {
            wireBankAccount();
        }

        // Always check and inject admin controls for authorized admins
        injectAdminControls();

        // Inject and maintain top banner install button if app is not installed
        updateTopBannerInstallButton();
    }

    /* ====================================================================
     * CHANGE PASSWORD — functional
     * ==================================================================== */
    function wireChangePassword() {
        var btn = document.querySelector('[data-action="save"]');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var form = btn.closest('div');
            var current = (document.querySelector('[data-model="current_password"]') || {}).value || '';
            var newPw = (document.querySelector('[data-model="password"]') || {}).value || '';
            var confirmPw = (document.querySelector('[data-model="password_confirmation"]') || {}).value || '';
            var s = (window.NexAuth && NexAuth.session()) || {};

            if (!current || !newPw || !confirmPw) { toast('Please fill in all fields.'); return; }
            if (current !== (s.password || '')) { toast('Current password is incorrect.'); return; }
            if (newPw.length < 6) { toast('New password must be at least 6 characters.'); return; }
            if (newPw !== confirmPw) { toast('Passwords do not match.'); return; }

            var updated = Object.assign({}, s, { password: newPw });
            if (window.NexAuth && NexAuth.store) NexAuth.store.login(updated);
            if (window.NexAuth && NexAuth.store) {
                var users = NexAuth.store.users();
                users.forEach(function (u) {
                    if (u.email === s.email || u.username === s.username) u.password = newPw;
                });
                localStorage.setItem('nx_users', JSON.stringify(users));
            }
            toast('Password updated successfully.', true);
            setTimeout(function () { window.location.href = 'profile.html'; }, 1000);
        });
    }

    /* ====================================================================
     * EDIT PROFILE — populate + save to localStorage
     * ==================================================================== */
    function wireEditProfile() {
        var s = (window.NexAuth && NexAuth.session()) || {};
        var parts = (s.fullName || '').split(/\s+/);
        setInput('[data-model="first_name"]', parts[0] || '');
        setInput('[data-model="last_name"]', parts.slice(1).join(' '));
        setInput('[data-model="phone"]', s.phone || '');
        var uname = document.querySelector('[data-model="username-display"]');
        if (uname) uname.textContent = '@' + (s.username || 'user');
        var email = document.querySelector('[data-model="email-display"]');
        if (email) email.textContent = s.email || '';

        var form = document.querySelector('[data-action="save-profile"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var first = val(form, 'first_name');
            var last = val(form, 'last_name');
            var phone = val(form, 'phone');
            var updated = Object.assign({}, s, {
                fullName: (first + ' ' + last).trim(),
                phone: phone
            });
            if (window.NexAuth && NexAuth.store) NexAuth.store.login(updated);
            // Update user record
            if (window.NexAuth && NexAuth.store) {
                var users = NexAuth.store.users();
                users.forEach(function (u) {
                    if (u.email === s.email || u.username === s.username) {
                        Object.assign(u, updated);
                    }
                });
                localStorage.setItem('nx_users', JSON.stringify(users));
            }
            toast('Profile saved successfully.', true);
            setTimeout(function () { window.location.href = '../profile.html'; }, 1000);
        }, true);
    }

    function setInput(sel, value) {
        var el = document.querySelector(sel);
        if (el && el.value !== undefined) el.value = value || '';
    }
    function val(ctx, name) {
        var el = ctx.querySelector('[data-model="' + name + '"]');
        return el ? (el.value || '').trim() : '';
    }

    /* ====================================================================
     * BANK ACCOUNT — Link account on profile with activation check
     * ==================================================================== */
    var NUALT_BANKS = [{name:"3Line Card Management Limited",code:"110005"},{name:"9 Payment Service Bank",code:"120001"},{name:"AB Microfinance Bank",code:"090270"},{name:"ABU Microfinance Bank",code:"090197"},{name:"AG Mortgage Bank",code:"100028"},{name:"AL-Barakah Microfinance Bank",code:"090133"},{name:"AMJU Unique Microfinance Bank",code:"090180"},{name:"AMML MFB",code:"090116"},{name:"ASOSavings & Loans",code:"090001"},{name:"Aaa Finance",code:"050005"},{name:"Abbey Mortgage Bank",code:"070010"},{name:"Above Only Microfinance Bank",code:"090260"},{name:"Abucoop  Microfinance Bank",code:"090424"},{name:"Abulesoro Microfinance Bank Ltd",code:"090545"},{name:"Accelerex Network",code:"090202"},{name:"Access Bank",code:"044"},{name:"AccessMobile",code:"100013"},{name:"Accion Microfinance Bank",code:"090134"},{name:"Ada Microfinance Bank",code:"090483"},{name:"Addosser Microfinance Bank",code:"090160"},{name:"Adeyemi College Staff Microfinance Bank",code:"090268"},{name:"Afekhafe Microfinance Bank",code:"090292"},{name:"Afemai Microfinance Bank",code:"090518"},{name:"Agosasa Microfinance Bank",code:"090371"},{name:"Aku Microfinance Bank",code:"090531"},{name:"Akuchukwu Microfinance Bank Ltd",code:"090561"},{name:"Akwa Savings & Loans Limited",code:"070025"},{name:"Al-Hayat Microfinance Bank",code:"090277"},{name:"Alekun Microfinance Bank",code:"090259"},{name:"Alert Microfinance Bank",code:"090297"},{name:"Allworkers Microfinance Bank",code:"090131"},{name:"Ally Microfinance Bank",code:"090548"},{name:"Alpha Kapital Microfinance Bank",code:"090169"},{name:"Alvana Microfinance Bank",code:"090489"},{name:"Amac Microfinance Bank",code:"090394"},{name:"Ampersand Microfinance Bank",code:"090529"},{name:"Anchorage Microfinance Bank",code:"090476"},{name:"Aniocha Microfinance Bank",code:"090469"},{name:"Apeks Microfinance Bank",code:"090143"},{name:"Apple  Microfinance Bank",code:"090376"},{name:"Aramoko Microfinance Bank",code:"090307"},{name:"Arca Payments",code:"110011"},{name:"Arise Microfinance Bank",code:"090282"},{name:"Aspire Microfinance Bank Ltd",code:"090544"},{name:"Assets Matrix Microfinance Bank",code:"090287"},{name:"Assets Microfinance Bank",code:"090473"},{name:"Astrapolaris Microfinance Bank",code:"090172"},{name:"Atbu  Microfinance Bank",code:"090451"},{name:"Auchi Microfinance Bank",code:"090264"},{name:"Avuenegbe Microfinance Bank",code:"090478"},{name:"Aztec Microfinance Bank",code:"090540"},{name:"BC Kash Microfinance Bank",code:"090127"},{name:"BRIDGEWAY MICROFINANCE BANK",code:"090393"},{name:"Baines Credit Microfinance Bank",code:"090188"},{name:"Balera Microfinance Bank Ltd",code:"090563"},{name:"Balogun Fulani  Microfinance Bank",code:"090181"},{name:"Balogun Gambari Microfinance Bank",code:"090326"},{name:"Banex Microfinance Bank",code:"090425"},{name:"Baobab Microfinance Bank",code:"090136"},{name:"Bayero Microfinance Bank",code:"090316"},{name:"Benysta Microfinance Bank",code:"090413"},{name:"Beta-Access Yello",code:"100052"},{name:"Bipc Microfinance Bank",code:"090336"},{name:"Bishopgate Microfinance Bank",code:"090555"},{name:"Blue Investments Microfinance Bank",code:"090538"},{name:"Bluewhales  Microfinance Bank",code:"090431"},{name:"Boctrust Microfinance Bank",code:"090117"},{name:"Boi Mf Bank",code:"090444"},{name:"Boji Boji Microfinance Bank",code:"090494"},{name:"Bonghe Microfinance Bank",code:"090319"},{name:"Borgu Microfinance Bank",code:"090395"},{name:"Borno Renaissance Microfinance Bank",code:"090508"},{name:"Boromu Microfinance Bank",code:"090501"},{name:"Borstal Microfinance Bank",code:"090454"},{name:"Bosak Microfinance Bank",code:"090176"},{name:"Bowen Microfinance Bank",code:"090148"},{name:"Branch International Financial Services",code:"050006"},{name:"Brent Mortgage Bank",code:"070015"},{name:"Brethren Microfinance Bank",code:"090293"},{name:"Brightway Microfinance Bank",code:"090308"},{name:"Broadview Microfinance Bank Ltd",code:"090568"},{name:"Bubayero Microfinance Bank",code:"090512"},{name:"Bud Infrastructure Limited",code:"110021"},{name:"Business Support Microfinance Bank",code:"090406"},{name:"CEMCS Microfinance Bank",code:"090154"},{name:"CIT Microfinance Bank",code:"090144"},{name:"Calabar Microfinance Bank",code:"090415"},{name:"Capitalmetriq Swift Microfinance Bank",code:"090509"},{name:"Capricorn Digital",code:"110023"},{name:"Capstone Mf Bank",code:"090445"},{name:"Carbon",code:"100026"},{name:"Caretaker Microfinance Bank",code:"090472"},{name:"Cashconnect   Microfinance Bank",code:"090360"},{name:"Catland Microfinance Bank",code:"090498"},{name:"Cedar Microfinance Bank Ltd",code:"090562"},{name:"Cellulant",code:"100005"},{name:"Cellulant Pssp",code:"110012"},{name:"Central Bank Of Nigeria",code:"000028"},{name:"ChamsMobile",code:"303"},{name:"Chanelle Bank",code:"090397"},{name:"Chase Microfinance Bank",code:"090523"},{name:"Cherish Microfinance Bank",code:"090440"},{name:"Chibueze Microfinance Bank",code:"090416"},{name:"Chikum Microfinance Bank",code:"090141"},{name:"Chukwunenye  Microfinance Bank",code:"090490"},{name:"Cintrust Microfinance Bank",code:"090480"},{name:"Citi Bank",code:"023"},{name:"Citizen Trust Microfinance Bank Ltd",code:"090343"},{name:"Cloverleaf  Microfinance Bank",code:"090511"},{name:"Coalcamp Microfinance Bank",code:"090254"},{name:"Coastline Microfinance Bank",code:"090374"},{name:"Confidence Microfinance Bank Ltd",code:"090530"},{name:"Consistent Trust Microfinance Bank Ltd",code:"090553"},{name:"Consumer Microfinance Bank",code:"090130"},{name:"Contec Global Infotech Limited (NowNow)",code:"100032"},{name:"Coop Mortgage Bank",code:"070021"},{name:"Corestep Microfinance Bank",code:"090365"},{name:"Coronation Merchant Bank",code:"060001"},{name:"County Finance Ltd",code:"050001"},{name:"Covenant Microfinance Bank",code:"070006"},{name:"Credit Afrique Microfinance Bank",code:"090159"},{name:"Crescent Microfinance Bank",code:"090526"},{name:"Crossriver  Microfinance Bank",code:"090429"},{name:"Crowdforce",code:"110017"},{name:"Crutech  Microfinance Bank",code:"090414"},{name:"DOT MICROFINANCE BANK",code:"090470"},{name:"Davodani  Microfinance Bank",code:"090391"},{name:"Daylight Microfinance Bank",code:"090167"},{name:"Delta Trust Mortgage Bank",code:"070023"},{name:"ENaira",code:"000033"},{name:"Eagle Flight Microfinance Bank",code:"090294"},{name:"Eartholeum",code:"100021"},{name:"Ebsu Microfinance Bank",code:"090427"},{name:"EcoBank PLC",code:"050"},{name:"EcoMobile",code:"100030"},{name:"Ecobank Xpress Account",code:"100008"},{name:"Edfin Microfinance Bank",code:"090310"},{name:"Egwafin Microfinance Bank Ltd",code:"090556"},{name:"Ek-Reliable Microfinance Bank",code:"090389"},{name:"Ekimogun Microfinance Bank",code:"090552"},{name:"Ekondo MFB",code:"090097"},{name:"Emeralds Microfinance Bank",code:"090273"},{name:"Empire trust MFB",code:"090114"},{name:"Enrich Microfinance Bank",code:"090539"},{name:"Enterprise Bank",code:"000019"},{name:"Esan Microfinance Bank",code:"090189"},{name:"Eso-E Microfinance Bank",code:"090166"},{name:"Evangel Microfinance Bank",code:"090304"},{name:"Evergreen Microfinance Bank",code:"090332"},{name:"Ewt Microfinance Bank",code:"090572"},{name:"Excellent Microfinance Bank",code:"090541"},{name:"Eyowo MFB",code:"090328"},{name:"FAST Microfinance Bank",code:"090179"},{name:"FBN Mortgages Limited",code:"090107"},{name:"FBNMobile",code:"100014"},{name:"FBNQUEST Merchant Bank",code:"060002"},{name:"FCMB Easy Account",code:"100031"},{name:"FEDETH MICROFINANCE BANK",code:"090482"},{name:"FET",code:"100001"},{name:"FFS Microfinance Bank",code:"090153"},{name:"FINATRUST MICROFINANCE BANK",code:"608"},{name:"FSDH Merchant Bank",code:"400001"},{name:"Fairmoney Microfinance Bank Ltd",code:"090551"},{name:"Fame Microfinance Bank",code:"090330"},{name:"Fcmb Microfinance Bank",code:"090409"},{name:"Fct Microfinance Bank",code:"090290"},{name:"Federal Polytechnic Nekede Microfinance Bank",code:"090398"},{name:"Federal University Dutse  Microfinance Bank",code:"090318"},{name:"Federalpoly Nasarawamfb",code:"090298"},{name:"Fewchore Finance Company Limited",code:"050002"},{name:"Fha Mortgage Bank Ltd",code:"070026"},{name:"Fidelity Bank",code:"070"},{name:"Fidelity Mobile",code:"100019"},{name:"Fidfund Microfinance Bank",code:"090126"},{name:"Fims Microfinance Bank",code:"090507"},{name:"Finca Microfinance Bank",code:"090400"},{name:"Firmus MFB",code:"090366"},{name:"First Bank PLC",code:"011"},{name:"First City Monument Bank",code:"214"},{name:"First Generation Mortgage Bank",code:"070014"},{name:"First Heritage Microfinance Bank",code:"090479"},{name:"First Multiple Microfinance Bank",code:"090163"},{name:"First Option Microfinance Bank",code:"090285"},{name:"First Royal Microfinance Bank",code:"090164"},{name:"Firstmidas Microfinance Bank Ltd",code:"090575"},{name:"Flutterwave Technology Solutions Limited",code:"110002"},{name:"Foresight Microfinance Bank",code:"090521"},{name:"Fortis Microfinance Bank",code:"070002"},{name:"FortisMobile",code:"100016"},{name:"Fortress Microfinance Bank",code:"090486"},{name:"Fullrange Microfinance Bank",code:"090145"},{name:"Futminna Microfinance Bank",code:"090438"},{name:"Futo Microfinance Bank",code:"090158"},{name:"GOODNEWS MFB",code:"090495"},{name:"GTMobile",code:"100009"},{name:"Garki Microfinance Bank",code:"090484"},{name:"Gashua Microfinance Bank",code:"090168"},{name:"Gateway Mortgage Bank",code:"070009"},{name:"Gbede Microfinance Bank",code:"090579"},{name:"Giant Stride Microfinance Bank",code:"090475"},{name:"Giginya Microfinance Bank",code:"090411"},{name:"Girei Microfinance Bank",code:"090186"},{name:"Giwa Microfinance Bank",code:"090441"},{name:"Globus Bank",code:"103"},{name:"Glory Microfinance Bank",code:"090278"},{name:"Gmb Microfinance Bank",code:"090408"},{name:"GoMoney",code:"100022"},{name:"Good Neighbours Microfinance Bank",code:"090467"},{name:"Gowans Microfinance Bank",code:"090122"},{name:"Green Energy Microfinance Bank Ltd",code:"090550"},{name:"GreenBank Microfinance Bank",code:"090178"},{name:"Greenville Microfinance Bank",code:"090269"},{name:"Greenwich Merchant Bank",code:"060004"},{name:"Grooming Microfinance Bank",code:"090195"},{name:"Gti  Microfinance Bank",code:"090385"},{name:"Guaranty Trust Bank",code:"058"},{name:"Gwong Microfinance Bank",code:"090500"},{name:"Hackman Microfinance Bank",code:"090147"},{name:"Haggai Mortgage Bank Limited",code:"070017"},{name:"Halacredit Microfinance Bank",code:"090291"},{name:"Hasal Microfinance Bank",code:"090121"},{name:"Headway Microfinance Bank",code:"090363"},{name:"Hedonmark",code:"100017"},{name:"Heritage Bank",code:"030"},{name:"HighStreet Microfinance Bank",code:"090175"},{name:"Highland Microfinance Bank",code:"090418"},{name:"Homebase Mortgage",code:"070024"},{name:"Hopepsb",code:"120002"},{name:"IBILE Microfinance Bank",code:"090118"},{name:"IRL Microfinance Bank",code:"090149"},{name:"Ibeto  Microfinance Bank",code:"090439"},{name:"Ibolo Micorfinance Bank Ltd",code:"090532"},{name:"Ibom Fadama Microfinance Bank",code:"090519"},{name:"Ibu-Aje Microfinance",code:"090488"},{name:"Ic Globalmicrofinance Bank",code:"090520"},{name:"Ijebu-Ife Microfinance Bank Ltd",code:"090546"},{name:"Ikenne Microfinance Bank",code:"090324"},{name:"Ikire Microfinance Bank",code:"090279"},{name:"Ikoyi-Osun Microfinance Bank",code:"090536"},{name:"Ilaro Poly Microfinance Bank Ltd",code:"090571"},{name:"Ilasan Microfinance Bank",code:"090370"},{name:"Illorin Microfinance Bank",code:"090350"},{name:"Ilora Microfinance Bank",code:"090430"},{name:"Imo State Microfinance Bank",code:"090258"},{name:"Imowo Microfinance Bank",code:"090417"},{name:"Imperial Homes Mortgage Bank",code:"100024"},{name:"Infinity Microfinance Bank",code:"090157"},{name:"Infinity Trust Mortgage Bank",code:"070016"},{name:"Innovectives Kesh",code:"100029"},{name:"Insight Microfinance Bank",code:"090434"},{name:"Intellifin",code:"100027"},{name:"Interland Microfinance Bank",code:"090386"},{name:"Interswitch Financial Inclusion Services (Ifis)",code:"110010"},{name:"Interswitch Limited",code:"110003"},{name:"Iperu Microfinance Bank",code:"090493"},{name:"Isaleoyo Microfinance Bank",code:"090377"},{name:"Ishie  Microfinance Bank",code:"090428"},{name:"Isuofia Microfinance Bank",code:"090353"},{name:"Itex Integrated Services Limited",code:"090211"},{name:"Iwade Microfinance Bank Ltd",code:"090578"},{name:"Iwoama Microfinance Bank",code:"090543"},{name:"Iyamoye Microfinance Bank Ltd",code:"090570"},{name:"Iyeru Okin Microfinance Bank Ltd",code:"090337"},{name:"Izon Microfinance Bank",code:"090421"},{name:"Jaiz Bank",code:"301"},{name:"Jessefield Microfinance Bank",code:"090352"},{name:"Jubilee-Life Mortgage  Bank",code:"090003"},{name:"KCMB Microfinance Bank",code:"090191"},{name:"Kadick Integration Limited",code:"110008"},{name:"Kadpoly Microfinance Bank",code:"090320"},{name:"Kayvee Microfinance Bank",code:"090554"},{name:"Kc Microfinance Bank",code:"090549"},{name:"Kegow",code:"100015"},{name:"Kegow(Chamsmobile)",code:"100036"},{name:"Keystone Bank",code:"082"},{name:"Kingdom College  Microfinance Bank",code:"090487"},{name:"Kontagora Microfinance Bank",code:"090299"},{name:"Koraypay",code:"110022"},{name:"Kredi Money Microfinance Bank",code:"090380"},{name:"Kuda",code:"090267"},{name:"Kwasu Mf Bank",code:"090450"},{name:"La  Fayette Microfinance Bank",code:"090155"},{name:"Lagos Building Investment Company",code:"070012"},{name:"Landgold  Microfinance Bank",code:"090422"},{name:"Lapo Microfinance Bank",code:"090177"},{name:"Lavender Microfinance Bank",code:"090271"},{name:"Legend Microfinance Bank",code:"090372"},{name:"Letshego MFB",code:"090420"},{name:"Lifegate Microfinance Bank Ltd",code:"090557"},{name:"Light Microfinance Bank",code:"090477"},{name:"Links Microfinance Bank",code:"090435"},{name:"Lobrem Microfinance Bank",code:"090537"},{name:"Lotus Bank",code:"000029"},{name:"Lovonus Microfinance Bank",code:"090265"},{name:"M36",code:"100035"},{name:"MAUTECH Microfinance Bank",code:"090423"},{name:"Mainland Microfinance Bank",code:"090323"},{name:"Mainstreet Microfinance Bank",code:"090171"},{name:"Maintrust Microfinance Bank",code:"090465"},{name:"Malachy Microfinance Bank",code:"090174"},{name:"Manny Microfinance bank",code:"090383"},{name:"Maritime Microfinance Bank",code:"090410"},{name:"Mayfair  Microfinance Bank",code:"090321"},{name:"Mayfresh Mortgage Bank",code:"070019"},{name:"Megapraise Microfinance Bank",code:"090280"},{name:"Memphis Microfinance Bank",code:"090432"},{name:"Mercury MFB",code:"090589"},{name:"Meridian Microfinance Bank",code:"090275"},{name:"Mgbidi Microfinance Bank",code:"090528"},{name:"Microsystems Investment And Development Limited",code:"110018"},{name:"Microvis Microfinance Bank",code:"090113"},{name:"Midland Microfinance Bank",code:"090192"},{name:"Mint-Finex MICROFINANCE BANK",code:"090281"},{name:"Mkudi",code:"100011"},{name:"Molusi Microfinance Bank",code:"090362"},{name:"Momo Psb",code:"120003"},{name:"Monarch Microfinance Bank",code:"090462"},{name:"Money Master Psb",code:"120005"},{name:"Money Trust Microfinance Bank",code:"090129"},{name:"MoneyBox",code:"100020"},{name:"Moniepoint Microfinance Bank",code:"090405"},{name:"Moyofade Mf Bank",code:"090448"},{name:"Mozfin Microfinance Bank",code:"090392"},{name:"Mutual Benefits Microfinance Bank",code:"090190"},{name:"Mutual Trust Microfinance Bank",code:"090151"},{name:"NIP Virtual Bank",code:"999999"},{name:"NIRSAL Microfinance Bank",code:"090194"},{name:"NPF MicroFinance Bank",code:"070001"},{name:"Nagarta Microfinance Bank",code:"090152"},{name:"Nasarawa Microfinance Bank",code:"090349"},{name:"Navy Microfinance Bank",code:"090263"},{name:"Ndiorah Microfinance Bank",code:"090128"},{name:"Neptune Microfinance Bank",code:"090329"},{name:"Netapps Technology Limited",code:"110025"},{name:"New Dawn Microfinance Bank",code:"090205"},{name:"New practical Bank",code:"090108"},{name:"Newedge Finance Ltd",code:"050004"},{name:"Nibssussd Payments",code:"110019"},{name:"Nice Microfinance Bank",code:"090459"},{name:"Nigeria Prisonsmicrofinance Bank",code:"090505"},{name:"Nkpolu-Ust Microfinance",code:"090535"},{name:"Nomba Financial Services Limited",code:"110028"},{name:"Nova Merchant Bank",code:"060003"},{name:"Nsuk  Microfinance Bank",code:"090491"},{name:"Numo Microfinance Bank",code:"090516"},{name:"Nuture Microfinance Bank",code:"090364"},{name:"Nwannegadi Microfinance Bank",code:"090399"},{name:"Oakland Microfinance Bank",code:"090437"},{name:"Oau Microfinance Bank Ltd",code:"090345"},{name:"Oche Microfinance Bank",code:"090333"},{name:"Octopus Microfinance Bank Ltd",code:"090576"},{name:"Ohafia Microfinance Bank",code:"090119"},{name:"Ojokoro Microfinance Bank",code:"090527"},{name:"Oke-Aro Oredegbe Microfinance Bank Ltd",code:"090565"},{name:"Okpoga Microfinance Bank",code:"090161"},{name:"Okuku Microfinance Bank Ltd",code:"090566"},{name:"Olabisi Onabanjo University Microfinance Bank",code:"090272"},{name:"Olofin Owena Microfinance Bank",code:"090468"},{name:"Olowolagba Microfinance Bank",code:"090404"},{name:"Oluchukwu Microfinance Bank",code:"090471"},{name:"Oluyole Microfinance Bank",code:"090460"},{name:"Omiye Microfinance Bank",code:"090295"},{name:"Omoluabi savings and loans",code:"070007"},{name:"One Finance",code:"100026"},{name:"Opay",code:"100004"},{name:"Optimus Bank",code:"000036"},{name:"Oraukwu  Microfinance Bank",code:"090492"},{name:"Orokam Microfinance Bank Ltd",code:"090567"},{name:"Oscotech Microfinance Bank",code:"090396"},{name:"Ospoly Microfinance Bank",code:"090456"},{name:"Otech Microfinance Bank Ltd",code:"090580"},{name:"Otuo Microfinance Bank Ltd",code:"090542"},{name:"PALMPAY",code:"100033"},{name:"Paga",code:"327"},{name:"Page Financials",code:"070008"},{name:"Palmcoast Microfinance Bank",code:"090497"},{name:"Parallex Bank",code:"000030"},{name:"Parkway Mf Bank",code:"090390"},{name:"Parkway-ReadyCash",code:"100003"},{name:"Parralex Microfinance bank",code:"090004"},{name:"PatrickGold Microfinance Bank",code:"090317"},{name:"PayAttitude Online",code:"110001"},{name:"Paycom",code:"305"},{name:"Paystack Payments Limited",code:"110006"},{name:"Peace Microfinance Bank",code:"090402"},{name:"PecanTrust Microfinance Bank",code:"090137"},{name:"Peniel Micorfinance Bank Ltd",code:"090379"},{name:"Pennywise Microfinance Bank",code:"090196"},{name:"Personal Trust Microfinance Bank",code:"090135"},{name:"Petra Microfinance Bank",code:"090165"},{name:"Pillar Microfinance Bank",code:"090289"},{name:"Platinum Mortgage Bank",code:"070013"},{name:"Polaris bank",code:"076"},{name:"Polyibadan Microfinance Bank",code:"090534"},{name:"Polyuwanna Microfinance Bank",code:"090296"},{name:"Preeminent Microfinance Bank",code:"090412"},{name:"PremiumTrust Bank",code:"000031"},{name:"Prestige Microfinance Bank",code:"090274"},{name:"Prisco  Microfinance Bank",code:"090481"},{name:"Pristine Divitis Microfinance Bank",code:"090499"},{name:"Projects Microfinance Bank",code:"090503"},{name:"ProvidusBank PLC",code:"101"},{name:"Purplemoney Microfinance Bank",code:"090303"},{name:"Qr Payments",code:"110013"},{name:"Qube Microfinance Bank Ltd",code:"090569"},{name:"Quickfund Microfinance Bank",code:"090261"},{name:"Radalpha Microfinance Bank",code:"090496"},{name:"Rahama Microfinance Bank",code:"090170"},{name:"Rand merchant Bank",code:"502"},{name:"Refuge Mortgage Bank",code:"070011"},{name:"Regent Microfinance Bank",code:"090125"},{name:"Rehoboth Microfinance Bank",code:"090463"},{name:"Reliance Microfinance Bank",code:"090173"},{name:"RenMoney Microfinance Bank",code:"090198"},{name:"Rephidim Microfinance Bank",code:"090322"},{name:"Resident Fintech Limited",code:"110024"},{name:"Richway Microfinance Bank",code:"090132"},{name:"Rigo Microfinance Bank",code:"090433"},{name:"Rima Growth Pathway Microfinance Bank",code:"090515"},{name:"Rima Microfinance Bank",code:"090443"},{name:"Rockshield Microfinance Bank",code:"090547"},{name:"Royal Exchange Microfinance Bank",code:"090138"},{name:"Rubies Microfinance Bank",code:"090175"},{name:"Safe Haven MFB",code:"090286"},{name:"SafeTrust",code:"090006"},{name:"Safegate Microfinance Bank",code:"090485"},{name:"Sagamu Microfinance Bank",code:"090140"},{name:"Sagegrey Finance Limited",code:"050003"},{name:"Seap Microfinance Bank",code:"090513"},{name:"Seed Capital Microfinance Bank",code:"090112"},{name:"Seedvest Microfinance Bank",code:"090369"},{name:"Shalom Microfinance Bank",code:"090502"},{name:"Shepherd Trust Microfinance Bank",code:"090401"},{name:"Shield Microfinance Bank Ltd",code:"090559"},{name:"Shongom Microfinance Bank Ltd",code:"090558"},{name:"Sls  Mf Bank",code:"090449"},{name:"Smartcash Payment Service Bank",code:"120004"},{name:"Snow Microfinance Bank",code:"090573"},{name:"Solid Allianze Microfinance Bank",code:"090506"},{name:"Solidrock Microfinance Bank",code:"090524"},{name:"Sparkle",code:"090325"},{name:"Spay Business",code:"110026"},{name:"Spectrum Microfinance Bank",code:"090436"},{name:"Stanbic IBTC @ease wallet",code:"100007"},{name:"Stanbic IBTC Bank",code:"221"},{name:"Standard Chaterted bank PLC",code:"068"},{name:"Standard Microfinance Bank",code:"090182"},{name:"Stanford Microfinance Bak",code:"090162"},{name:"Stb Mortgage Bank",code:"070022"},{name:"Stellas Microfinance Bank",code:"090262"},{name:"Sterling Bank PLC",code:"232"},{name:"Stockcorp  Microfinance Bank",code:"090340"},{name:"Sulsap Microfinance Bank",code:"090305"},{name:"Sunbeam Microfinance Bank",code:"090302"},{name:"Suntrust Bank",code:"100"},{name:"Support Mf Bank",code:"090446"},{name:"Supreme Microfinance Bank Ltd",code:"090564"},{name:"TANADI MFB (CRUST)",code:"090560"},{name:"TCF MFB",code:"090115"},{name:"TagPay",code:"100023"},{name:"Taj Bank Limited",code:"000026"},{name:"Tajwallet",code:"080002"},{name:"Tangerine Bank",code:"090426"},{name:"TeamApt",code:"110007"},{name:"TeasyMobile",code:"100010"},{name:"Tf Microfinance Bank",code:"090373"},{name:"Thrive Microfinance Bank",code:"090283"},{name:"Titan Trust Bank",code:"000025"},{name:"Titan-Paystack",code:"100039"},{name:"Trident Microfinance Bank",code:"090146"},{name:"Triple A Microfinance Bank",code:"090525"},{name:"Trust Microfinance Bank",code:"090327"},{name:"Trustbond Mortgage Bank",code:"090005"},{name:"Trustfund Microfinance Bank",code:"090276"},{name:"U And C Microfinance Bank",code:"090315"},{name:"UNN MFB",code:"090251"},{name:"Uda Microfinance Bank",code:"090403"},{name:"Uhuru Microfinance Bank",code:"090517"},{name:"Umuchinemere Procredit Microfinance Bank",code:"090514"},{name:"Umunnachi Microfinance Bank",code:"090510"},{name:"Unaab Microfinance Bank",code:"090331"},{name:"Uniben Microfinance Bank",code:"090266"},{name:"Unical Microfinance Bank",code:"090193"},{name:"Uniibadan Microfinance Bank",code:"090461"},{name:"Unilag  Microfinance Bank",code:"090452"},{name:"Unilorin Microfinance Bank",code:"090341"},{name:"Unimaid Microfinance Bank",code:"090464"},{name:"Union Bank PLC",code:"032"},{name:"United Bank for Africa",code:"033"},{name:"Unity Bank PLC",code:"215"},{name:"Uniuyo Microfinance Bank",code:"090338"},{name:"Uzondu Mf Bank",code:"090453"},{name:"VFD Micro Finance Bank",code:"090110"},{name:"VTNetworks",code:"100012"},{name:"Vas2Nets Limited",code:"110015"},{name:"Verdant Microfinance Bank",code:"090474"},{name:"Verite Microfinance Bank",code:"090123"},{name:"Virtue Microfinance Bank",code:"090150"},{name:"Visa Microfinance Bank",code:"090139"},{name:"Wema Bank PLC",code:"035"},{name:"Wetland Microfinance Bank",code:"090120"},{name:"Winview Bank",code:"090419"},{name:"Woven Finance",code:"110029"},{name:"Xpress Payments",code:"090201"},{name:"Xslnce Microfinance Bank",code:"090124"},{name:"Yct Microfinance Bank",code:"090466"},{name:"Yello Digital Financial Services",code:"110027"},{name:"Yes Microfinance Bank",code:"090142"},{name:"Yobe Microfinance Bank",code:"090252"},{name:"Zenith bank PLC",code:"057"},{name:"ZenithMobile",code:"100018"},{name:"Zikora Microfinance Bank",code:"090504"},{name:"Zinternet Nigera Limited",code:"100025"},{name:"Zwallet",code:"100034"},{name:"e-Barcs Microfinance Bank",code:"090156"},{name:"eTranzact",code:"100006"}];

    function showBankActivationPromptModal() {
        var m = $('nx-bank-locked-modal');
        if (m) m.remove();
        m = el('div', 'nx-bank-locked-modal');
        m.id = 'nx-bank-locked-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
        m.innerHTML = '<div style="background:#fff;border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.2);position:relative;animation:nxFabPop 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
            '<button type="button" class="nx-modal-x" data-nx-bank-locked-close style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">' +
                '<svg viewBox="0 0 24 24" fill="none" class="w-5 h-5"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<div style="width:64px;height:64px;border-radius:50%;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;">' +
                '<svg viewBox="0 0 24 24" width="32" height="32" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#d97706" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#d97706" stroke-width="2"/></svg>' +
            '</div>' +
            '<h3 style="font-size:20px;font-weight:700;color:#7C3AED;margin:0 0 8px;">Activation Required</h3>' +
            '<p style="font-size:14px;color:#64748b;line-height:1.5;margin:0 0 24px;">Adding bank account to profile is available for activated accounts. Activate your account to link your bank details.</p>' +
            '<button type="button" data-nx-bank-activate class="nx-gate-btn" style="width:100%;margin-bottom:8px;background:#7C3AED;color:#fff;padding:14px;border-radius:999px;font-weight:600;font-size:15px;border:none;cursor:pointer;">Activate Account</button>' +
            '<button type="button" data-nx-bank-locked-close class="nx-gate-btn" style="width:100%;background:#f1f5f9;color:#7C3AED;padding:12px;border-radius:999px;font-weight:600;font-size:14px;border:none;cursor:pointer;">Cancel</button>' +
        '</div>';
        document.body.appendChild(m);
        m.querySelector('[data-nx-bank-activate]').addEventListener('click', function () {
            m.remove();
            loadTaskVestConfig().then(function (config) {
                config = config || NEXTEL_CONFIG;
                var usePaymentLink = !!(config.usePaymentLink || config.use_payment_link);
                var usePaystackGateway = !!(config.usePaystackGatewayApi || config.use_paystack_gateway_api);

                if (usePaystackGateway) {
                    startEsimPurchase('elite');
                    return;
                }

                if (usePaymentLink) {
                    var pLink1 = config.paymentLink1 || config.payment_link_1 || '';
                    var pLink2 = config.paymentLink2 || config.payment_link_2 || '';
                    var target = normalizeExternalUrl(pLink2 || pLink1);
                    if (target) {
                        toast('Redirecting to secure payment checkout…', true);
                        setTimeout(function () {
                            try { window.location.assign(target); } catch (_) { window.location.href = target; }
                        }, 200);
                        return;
                    }
                }
                if (!$('nx-esim-modal')) {
                    document.body.appendChild(buildEsimModal());
                }
                showEsimModal();
            });
        });
        m.querySelectorAll('[data-nx-bank-locked-close]').forEach(function (btn) {
            btn.addEventListener('click', function () { m.remove(); });
        });
        m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    }

    function showSavedPopup(bankName, acctNum, acctName) {
        var overlay = el('div', 'nx-bank-saved-modal');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div style="background:#fff;border-radius:28px;padding:36px 28px;max-width:360px;width:100%;text-align:center;animation:nxFabPop 0.35s cubic-bezier(0.34,1.2,0.64,1);box-shadow:0 20px 50px rgba(0,0,0,0.25);position:relative;">' +
            '<button type="button" class="nx-saved-close" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<div style="width:72px;height:72px;margin:0 auto 20px;border-radius:50%;background:rgba(124, 58, 237, 0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(124, 58, 237, 0.06);">' +
                '<svg viewBox="0 0 24 24" width="36" height="36" fill="none"><circle cx="12" cy="12" r="10" stroke="#7C3AED" stroke-width="2"/><path d="M8 12.5L11 15.5L16.5 9.5" stroke="#7C3AED" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</div>' +
            '<h3 style="font-size:22px;font-weight:700;color:#7C3AED;margin:0 0 8px;">Account Details Linked</h3>' +
            '<p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5;">Your Nigerian bank account details have been linked and verified successfully.</p>' +
            '<div style="background:rgba(124, 58, 237, 0.05);border:1px solid rgba(124, 58, 237, 0.1);border-radius:14px;padding:16px;margin-bottom:24px;text-align:left;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Bank</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + bankName + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Number</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + acctNum + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:#8c8c8c;">Account Name</span><span style="font-size:13px;font-weight:600;color:#7C3AED;">' + acctName + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed rgba(124, 58, 237, 0.15);"><span style="font-size:12px;color:#8c8c8c;">Status</span><span style="font-size:11px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:2px 8px;border-radius:999px;">✓ Verified</span></div>' +
            '</div>' +
            '<button type="button" class="nx-saved-close" style="width:100%;padding:14px;border-radius:999px;background:#7C3AED;color:#fff;border:none;font-weight:600;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(124, 58, 237, 0.25);">Done</button>' +
        '</div>';
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.nx-saved-close').forEach(function(btn) {
            btn.addEventListener('click', function () { overlay.remove(); });
        });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    }

    function wireBankAccount() {
        var bankSearch = document.getElementById('bankSearch');
        var bankCode = document.getElementById('bankCode');
        var bankDropdown = document.getElementById('bankDropdown');
        var acctInput = document.getElementById('accountNumberInput');
        var acctNameInput = document.getElementById('accountNameInput');
        var linkBtn = document.getElementById('linkAccountBtn') || document.getElementById('verifyAccountBtn');
        if (!bankSearch || !linkBtn || !bankDropdown) return;

        // Prevent double binding
        if (bankSearch.dataset.nxWired === 'true') return;
        bankSearch.dataset.nxWired = 'true';

        var session = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};

        // Top popular Nigerian banks priority order with standard Paystack codes
        var POPULAR_CODES = ['058', '057', '044', '011', '033', '214', '221', '035', '070', '032', '232', '101', '076', '082', '301', '100004', '999992', '100033', '999991', '090267', '50211', '090405', '50515', '090110', '566'];

        var sortedBanks = NUALT_BANKS.slice().sort(function(a, b) {
            var aIdx = POPULAR_CODES.indexOf(a.code);
            var bIdx = POPULAR_CODES.indexOf(b.code);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.name.localeCompare(b.name);
        });

        // Verification State Tracker
        var isAccountVerified = !!(session.bankAccountNumber && session.bankAccountName);
        var isVerifying = false;
        var lastVerifiedAccount = session.bankAccountNumber || '';
        var lastVerifiedCode = session.bankCode || '';

        function updateUIState() {
            if (isVerifying) {
                linkBtn.disabled = true;
                linkBtn.style.opacity = '0.7';
                linkBtn.style.cursor = 'wait';
                linkBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg style="animation:spin 1s linear infinite;width:16px;height:16px;" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25;"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style="opacity:0.75;"></path></svg>Verifying Account…</span>';
            } else {
                linkBtn.disabled = false;
                linkBtn.style.opacity = '1';
                linkBtn.style.cursor = 'pointer';
                linkBtn.textContent = 'Link Account';
            }
        }

        // Trigger Nigerian Bank Account Verification via Supabase Edge Function
        var verifyDebounceTimer = null;
        async function triggerAccountVerification() {
            var rawAcct = (acctInput ? acctInput.value : '').trim().replace(/\D/g, '');
            var code = (bankCode ? bankCode.value : '').trim();

            if (rawAcct.length !== 10 || !code) {
                return;
            }

            if (isAccountVerified && rawAcct === lastVerifiedAccount && code === lastVerifiedCode) {
                return;
            }

            isVerifying = true;
            isAccountVerified = false;
            if (acctNameInput) {
                acctNameInput.value = '';
                acctNameInput.placeholder = 'Verifying account holder name…';
                acctNameInput.readOnly = true;
            }
            updateUIState();

            try {
                // Real NUBAN resolution via the /api/resolve proxy (nuAlt).
                var res = null;
                try {
                    var fetchRes = await fetch('/api/resolve?acc_no=' + encodeURIComponent(rawAcct) + '&bank=' + encodeURIComponent(code), { headers: { 'Accept': 'application/json' } });
                    var raw = await fetchRes.text();
                    var data = null;
                    try { data = JSON.parse(raw); } catch (_) { data = null; }
                    if (data && data.ok && Array.isArray(data.result) && data.result[0] && data.result[0].account_name) {
                        res = { verified: true, account_name: data.result[0].account_name };
                    } else {
                        res = { verified: false, error: (data && (data.detail || data.error || data.message)) || 'Could not verify this account. Check the number and bank.' };
                    }
                } catch (netErr) {
                    res = { verified: false, error: 'Bank verification service unavailable. Please try again.' };
                }

                if (res && (res.verified === true || res.success === true) && res.account_name) {
                    var verifiedName = String(res.account_name).trim();
                    if (acctNameInput) {
                        acctNameInput.value = verifiedName;
                        acctNameInput.placeholder = 'Enter account holder name';
                    }
                    isAccountVerified = true;
                    lastVerifiedAccount = rawAcct;
                    lastVerifiedCode = code;
                    toast('Account verified: ' + verifiedName, true);
                } else {
                    isAccountVerified = false;
                    if (acctNameInput) {
                        acctNameInput.value = '';
                        acctNameInput.placeholder = 'Enter account holder name';
                    }
                    var errMsg = (res && res.error) || 'Could not verify bank account. Please check your account number and bank.';
                    toast(errMsg);
                }
            } catch (err) {
                console.error('[Bank Account Verification Error]', err);
                isAccountVerified = false;
                if (acctNameInput) {
                    acctNameInput.value = '';
                    acctNameInput.placeholder = 'Enter account holder name';
                }
                toast('Bank verification failed. Please check network and try again.');
            } finally {
                isVerifying = false;
                if (acctNameInput) acctNameInput.readOnly = false;
                updateUIState();
            }
        }

        function scheduleVerification() {
            clearTimeout(verifyDebounceTimer);
            verifyDebounceTimer = setTimeout(triggerAccountVerification, 350);
        }

        function renderBankList(filterQuery) {
            var q = (filterQuery || '').toLowerCase().trim();
            var list = q ? sortedBanks.filter(function (b) {
                return b.name.toLowerCase().indexOf(q) !== -1;
            }) : sortedBanks;

            if (!list.length) {
                bankDropdown.innerHTML = '<div style="padding:14px;font-size:13px;color:#8c8c8c;text-align:center;">No matching bank found</div>';
                bankDropdown.style.display = 'block';
                return;
            }

            var html = list.slice(0, 80).map(function (b) {
                var isPop = POPULAR_CODES.indexOf(b.code) !== -1;
                return '<div class="nx-bank-item" data-bank-code="' + b.code + '" data-bank-name="' + b.name.replace(/"/g, '&quot;') + '" style="padding:12px 16px;cursor:pointer;font-size:13.5px;color:#1e293b;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;transition:background 0.15s;-webkit-tap-highlight-color:rgba(0,0,0,0.05);">' +
                    '<span style="font-weight:500;">' + b.name + '</span>' +
                    (isPop && !q ? '<span style="font-size:10.5px;font-weight:600;color:#7C3AED;background:#F1EEFB;padding:2px 8px;border-radius:999px;">Popular</span>' : '') +
                '</div>';
            }).join('');

            bankDropdown.innerHTML = html;
            bankDropdown.style.display = 'block';
        }

        // Show dropdown immediately on click / focus / touch
        function openDropdown(e) {
            if (e) {
                try { e.stopPropagation(); } catch (_) {}
            }
            var currentVal = bankSearch.value.trim();
            renderBankList(currentVal === (session.bankName || '') ? '' : currentVal);
        }

        bankSearch.addEventListener('click', openDropdown);
        bankSearch.addEventListener('focus', openDropdown);
        bankSearch.addEventListener('input', function () {
            renderBankList(this.value);
            // Changing bank must clear previous name and verification status
            if (isAccountVerified || (acctNameInput && acctNameInput.value)) {
                isAccountVerified = false;
                if (acctNameInput) acctNameInput.value = '';
            }
        });

        // Also handle click on parent wrapper or arrow icon
        var searchParent = bankSearch.parentElement;
        if (searchParent) {
            searchParent.addEventListener('click', function (e) {
                if (bankDropdown.style.display !== 'block') {
                    openDropdown(e);
                    bankSearch.focus();
                }
            });
        }

        // Event delegation for bank selection
        function selectBankItem(target) {
            var item = target.closest('[data-bank-code]');
            if (!item) return;
            var code = item.getAttribute('data-bank-code');
            var name = item.getAttribute('data-bank-name');
            if (bankCode) bankCode.value = code;
            if (bankSearch) {
                bankSearch.value = name;
            }
            bankDropdown.style.display = 'none';

            // Changing bank clears previous name and status, then verifies if 10 digits exist
            isAccountVerified = false;
            if (acctNameInput) acctNameInput.value = '';

            var currentNum = (acctInput ? acctInput.value : '').replace(/\D/g, '');
            if (currentNum.length === 10) {
                scheduleVerification();
            }
        }

        bankDropdown.addEventListener('mousedown', function (e) {
            selectBankItem(e.target);
        });
        bankDropdown.addEventListener('click', function (e) {
            selectBankItem(e.target);
        });

        // Close dropdown on outside click
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#bankSearch') && !e.target.closest('#bankDropdown') && !e.target.closest('#bankSearchWrapper')) {
                bankDropdown.style.display = 'none';
            }
        });

        // Account number input listener: enforce 10 digits, clear status on change, trigger auto-verify
        if (acctInput) {
            acctInput.addEventListener('input', function () {
                var clean = this.value.replace(/\D/g, '').slice(0, 10);
                if (this.value !== clean) {
                    this.value = clean;
                }

                // Changing account number clears previous name & verification status
                if (clean !== lastVerifiedAccount) {
                    isAccountVerified = false;
                    if (acctNameInput) acctNameInput.value = '';
                }

                if (clean.length === 10 && bankCode && bankCode.value) {
                    scheduleVerification();
                }
            });

            acctInput.addEventListener('blur', function() {
                var clean = this.value.replace(/\D/g, '').slice(0, 10);
                if (clean.length === 10 && bankCode && bankCode.value && !isAccountVerified) {
                    triggerAccountVerification();
                }
            });
        }

        // Load saved data if exists
        if (session.bankName) bankSearch.value = session.bankName;
        if (session.bankCode && bankCode) bankCode.value = session.bankCode;
        if (session.bankAccountNumber && acctInput) acctInput.value = session.bankAccountNumber;
        if (session.bankAccountName && acctNameInput) {
            acctNameInput.value = session.bankAccountName;
            isAccountVerified = true;
            lastVerifiedAccount = session.bankAccountNumber;
            lastVerifiedCode = session.bankCode;
        }

        // Link Account button click handler: only allow submission when verified
        linkBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            var bank = bankSearch.value.trim();
            var code = (bankCode && bankCode.value) || '';
            var acct = (acctInput ? acctInput.value : '').trim().replace(/\D/g, '');
            var acctName = (acctNameInput ? acctNameInput.value : '').trim();

            if (!bank) { toast('Please select your bank.'); return; }
            if (acct.length !== 10) { toast('Enter a valid 10-digit Nigerian account number.'); return; }

            // If not verified yet, trigger verification first
            if (!isAccountVerified || !acctName) {
                toast('Verifying bank account details, please wait…');
                await triggerAccountVerification();
                acctName = (acctNameInput ? acctNameInput.value : '').trim();
                if (!isAccountVerified || !acctName) {
                    toast('Only successfully verified bank accounts can be linked.');
                    return;
                }
            }

            var s = (window.NexAuth && NexAuth.session && NexAuth.session()) || {};
            var updated = Object.assign({}, s, {
                bankCode: code || '000',
                bankName: bank,
                bankAccountNumber: acct,
                bankAccountName: acctName
            });

            if (window.NexAuth && NexAuth.store) {
                NexAuth.store.login(updated);
                var users = NexAuth.store.users();
                users.forEach(function (u) {
                    if (u.email === s.email || u.username === s.username) Object.assign(u, updated);
                });
                localStorage.setItem('nx_users', JSON.stringify(users));
            }

            showSavedPopup(updated.bankName, updated.bankAccountNumber, updated.bankAccountName);
        });
    }

    /* ====================================================================
     * PROFILE PAGE — personalise from localStorage
     * ==================================================================== */
    function personaliseProfile() {
        var s = (window.NexAuth && NexAuth.session()) || {};
        var fullName = s.fullName || s.username || 'User';
        var username = s.username || 'user';
        var email = s.email || '';
        var avatar = $('[data-nx-avatar]');
        var nameEl = $('[data-nx-fullname]');
        var infoEl = $('[data-nx-userinfo]');

        if (avatar) avatar.textContent = fullName.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = fullName;
        if (infoEl) infoEl.textContent = '@' + username + (email ? ' · ' + email : '');

        // Plan badge
        var badge = $('[data-nx-plan-badge]');
        if (badge) {
            if (isActive()) {
                badge.style.background = 'rgba(124, 58, 237, 0.1)';
                badge.style.color = '#7C3AED';
                badge.innerHTML = '<span class="size-1.5 rounded-full" style="background:#7C3AED;"></span>Activated account';
            } else {
                badge.style.background = 'rgba(255,77,109,0.1)';
                badge.style.color = '#ff4d6d';
                badge.innerHTML = '<span class="size-1.5 rounded-full" style="background:#ff4d6d;"></span>Account Inactive';
            }
        }

        // Currency toggle buttons
        var activeCurr = getActiveCurrency();
        $all('#profileCurrencySwitch [data-curr-opt]').forEach(function(btn) {
            var opt = btn.getAttribute('data-curr-opt');
            if (opt === activeCurr) {
                btn.className = 'px-3 py-1 rounded-full text-[12px] font-semibold transition bg-primary text-white shadow-sm';
            } else {
                btn.className = 'px-3 py-1 rounded-full text-[12px] font-semibold transition text-muted hover:text-text';
            }
        });
    }

    /* ====================================================================
     * TRANSACTIONS PAGE — inline withdraw logic
     * ==================================================================== */
    function wireTransactionsPage() {
        refreshTransactionsPage();
        renderWithdrawHistoryInline();

        // Wire the inline verify input
        var input = $('[data-nx-vinput]');
        if (input) {
            input.addEventListener('input', function () {
                this.value = this.value.toUpperCase().slice(0, 13);
                this.classList.remove('error');
                var err = $('[data-nx-verr]');
                if (err) err.textContent = '';
            });
        }

        // Wire withdraw amount input to instantly update requested balance display
        var amtInput = document.getElementById('nxWithdrawAmountInput') || document.querySelector('[data-nx-wd-amount-input]');
        if (amtInput) {
            amtInput.addEventListener('input', function () {
                var v = Number(this.value);
                if (!isNaN(v) && v > 0) {
                    lastRequestedWithdrawAmount = v;
                    var vb = document.querySelector('[data-nx-vbalance]');
                    if (vb) vb.textContent = money(v);
                }
            });
        }
    }

    function refreshTransactionsPage() {
        var total = earnings();
        var balEl = $('[data-nx-wd-balance]');
        var pctEl = $('[data-nx-wd-percent]');
        var fillEl = $('[data-nx-wd-fill]');
        var remainEl = $('[data-nx-wd-remaining]');
        var minEls = $all('[data-nx-wd-min]');
        var statusEl = $('[data-nx-wd-status]');
        var titleEl = $('[data-nx-wd-status-title]');
        var textEl = $('[data-nx-wd-status-text]');
        var vbalEl = $('[data-nx-vbalance]');

        if (balEl) balEl.textContent = money(total);

        // Keep requested amount synchronized without resetting user-selected values
        var amtInput = document.getElementById('nxWithdrawAmountInput') || document.querySelector('[data-nx-wd-amount-input]');
        if (amtInput && amtInput.value && !isNaN(Number(amtInput.value)) && Number(amtInput.value) > 0) {
            lastRequestedWithdrawAmount = Number(amtInput.value);
        }

        var displayVBal = lastRequestedWithdrawAmount || total || CONST.WITHDRAW_THRESHOLD;
        if (vbalEl) vbalEl.textContent = money(displayVBal);

        updateEsimWithdrawalFlowUI();

        minEls.forEach(function(m) {
            m.textContent = 'Min: ' + money(CONST.WITHDRAW_THRESHOLD);
        });

        var p = Math.min(100, (total / CONST.WITHDRAW_THRESHOLD) * 100);
        if (pctEl) pctEl.textContent = Math.floor(p) + '%';
        if (fillEl) fillEl.style.width = p + '%';

        if (total < CONST.WITHDRAW_THRESHOLD) {
            var remain = CONST.WITHDRAW_THRESHOLD - total;
            if (remainEl) remainEl.textContent = money(remain) + ' remaining to unlock withdrawals';
            if (statusEl) { statusEl.style.borderLeftColor = '#e07c2c'; }
            if (titleEl) { titleEl.textContent = '🔒 Withdrawal Locked'; titleEl.style.color = '#d7771f'; }
            if (textEl) textEl.textContent = 'Keep completing tasks until you reach ' + money(CONST.WITHDRAW_THRESHOLD) + '.';
        } else {
            if (remainEl) remainEl.textContent = 'Withdrawal threshold reached.';
            if (statusEl) { statusEl.style.borderLeftColor = '#2fbf71'; }
            if (titleEl) { titleEl.textContent = '✓ Withdrawal Available'; titleEl.style.color = '#2fbf71'; }
            if (textEl) textEl.textContent = "You've reached the withdrawal threshold. You can now continue.";
        }

        if (amtInput) {
            amtInput.min = String(CONST.WITHDRAW_THRESHOLD);
            if (!amtInput.value && document.activeElement !== amtInput) {
                amtInput.placeholder = CONST.WITHDRAW_THRESHOLD.toLocaleString('en-US');
            }
        }

        var firstChip = document.querySelector('.nx-wd-chip');
        if (firstChip && firstChip.dataset.isMinChip !== 'false') {
            firstChip.setAttribute('data-amt', String(CONST.WITHDRAW_THRESHOLD));
            firstChip.textContent = money(CONST.WITHDRAW_THRESHOLD);
        }
    }

    function updateActivationCountdownBanner() {
        var countdownEls = document.querySelectorAll('[data-nx-activation-countdown]');
        var slideCountdown = document.getElementById('slideCountdownBanner');
        var pagination = document.getElementById('bannerPaginationDots');
        var track = document.getElementById('bannerSliderTrack');

        var cfg = (function() {
            var show = true;
            var rawShow = (window.NEXTEL_CONFIG && (window.NEXTEL_CONFIG.showActivationCountdown !== undefined ? window.NEXTEL_CONFIG.showActivationCountdown : window.NEXTEL_CONFIG.show_activation_countdown))
                || (window.DEFAULT_GUARD && (window.DEFAULT_GUARD.showActivationCountdown !== undefined ? window.DEFAULT_GUARD.showActivationCountdown : window.DEFAULT_GUARD.show_activation_countdown))
                || (typeof localStorage !== 'undefined' && localStorage.getItem('nx_show_activation_countdown'));
            if (rawShow !== undefined && rawShow !== null && rawShow !== '') {
                show = typeof rawShow === 'string' ? (rawShow.trim().toLowerCase() !== 'false' && rawShow.trim() !== '0') : !!rawShow;
            }

            var days = 3;
            var rawDays = (window.NEXTEL_CONFIG && (window.NEXTEL_CONFIG.activationCountdownDays || window.NEXTEL_CONFIG.activation_countdown_days))
                || (window.DEFAULT_GUARD && (window.DEFAULT_GUARD.activationCountdownDays || window.DEFAULT_GUARD.activation_countdown_days))
                || (typeof localStorage !== 'undefined' && localStorage.getItem('nx_activation_countdown_days'));
            var parsedDays = Number(rawDays);
            if (!isNaN(parsedDays) && parsedDays > 0) {
                days = parsedDays;
            }
            return { show: show, days: days };
        })();

        var s = (window.NexAuth && typeof NexAuth.session === 'function' && NexAuth.session()) || {};
        var isAct = !!(s.accountActive || s.account_active || localStorage.getItem(uk('nx_account_active')) === 'true' || localStorage.getItem('nx_active') === 'true');

        var createdStr = s.created_at || s.createdAt || localStorage.getItem(uk('nx_created_at'));
        var createdTime = NaN;
        if (createdStr) {
            createdTime = new Date(createdStr).getTime();
        }
        if (isNaN(createdTime) || createdTime <= 0) {
            createdTime = Date.now();
            localStorage.setItem(uk('nx_created_at'), new Date(createdTime).toISOString());
        }

        var expireTime = createdTime + (cfg.days * 24 * 60 * 60 * 1000);
        var now = Date.now();
        var diff = expireTime - now;
        var isExpired = (diff <= 0);

        var tgCfg = (function() {
            var display = true;
            var rawDisplay = (window.NEXTEL_CONFIG && (window.NEXTEL_CONFIG.displayJoinTgChannel !== undefined ? window.NEXTEL_CONFIG.displayJoinTgChannel : window.NEXTEL_CONFIG.display_join_tg_channel))
                || (window.DEFAULT_GUARD && (window.DEFAULT_GUARD.displayJoinTgChannel !== undefined ? window.DEFAULT_GUARD.displayJoinTgChannel : window.DEFAULT_GUARD.display_join_tg_channel))
                || (typeof localStorage !== 'undefined' && localStorage.getItem('nx_display_join_tg_channel'));
            if (rawDisplay !== undefined && rawDisplay !== null && rawDisplay !== '') {
                display = typeof rawDisplay === 'string' ? (rawDisplay.trim().toLowerCase() !== 'false' && rawDisplay.trim() !== '0') : !!rawDisplay;
            }

            var hardcodedTgUrl = 'https://t.me/TaskVestconnect';
            var cfgTg = (window.NEXTEL_CONFIG && (window.NEXTEL_CONFIG.telegramLink || window.NEXTEL_CONFIG.telegram_link)) || '';
            if (!cfgTg && typeof localStorage !== 'undefined') {
                try {
                    var _cs = JSON.parse(localStorage.getItem('nx_system_settings') || '{}');
                    cfgTg = _cs.telegramLink || _cs.telegram_link || '';
                } catch (_) {}
            }
            var rawUrl = cfgTg
                || (window.NEXTEL_CONFIG && (window.NEXTEL_CONFIG.tgChannelUrl !== undefined ? window.NEXTEL_CONFIG.tgChannelUrl : window.NEXTEL_CONFIG.tg_channel_url))
                || (window.DEFAULT_GUARD && (window.DEFAULT_GUARD.tgChannelUrl !== undefined ? window.DEFAULT_GUARD.tgChannelUrl : window.DEFAULT_GUARD.tg_channel_url))
                || (typeof localStorage !== 'undefined' && localStorage.getItem('nx_tg_channel_url'));

            var url = hardcodedTgUrl;
            if (rawUrl !== undefined && rawUrl !== null && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
                url = rawUrl.trim();
            }
            return { display: display, url: url };
        })();

        var slideTelegram = document.getElementById('slideTelegramBanner');
        var tgLinkEl = document.getElementById('tgChannelJoinBtn') || (slideTelegram ? slideTelegram.querySelector('a') : null);
        if (tgLinkEl) {
            tgLinkEl.setAttribute('href', tgCfg.url);
        }

        if (!tgCfg.display) {
            if (slideTelegram) slideTelegram.style.display = 'none';
            if (pagination) pagination.style.display = 'none';
            if (track) track.style.transform = 'translateX(0%)';
            if (slideCountdown && slideCountdown.style.display === 'none') {
                slideCountdown.style.display = '';
            }
        } else {
            if (slideTelegram && slideTelegram.style.display === 'none') {
                slideTelegram.style.display = '';
            }
            if (!cfg.show || isAct || isExpired) {
                if (slideCountdown) slideCountdown.style.display = 'none';
                if (pagination) pagination.style.display = 'none';
                if (track) track.style.transform = 'translateX(0%)';
                return;
            }

            if (slideCountdown && slideCountdown.style.display === 'none') {
                slideCountdown.style.display = '';
            }
            if (pagination && pagination.style.display === 'none') {
                pagination.style.display = 'flex';
            }
        }

        if (!countdownEls.length) return;

        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((diff % (1000 * 60)) / 1000);
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        var formatted = days + 'd ' + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);

        countdownEls.forEach(function(el) {
            el.textContent = formatted;
        });
    }

    setInterval(updateActivationCountdownBanner, 1000);

    // Note: renderWithdrawHistory handles all inline & overlay withdrawal history cards cleanly

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ====================================================================
     * PUBLIC API
     * ==================================================================== */
    window.TaskVestTasks = {
        isActive: isActive,
        activate: function () { setActive(true); refreshAll(); },
        earnings: earnings,
        balance: earnings,
        addEarnings: function (n, label, wallet) { addEarnings(n, label, wallet); refreshAll(); },
        setBalance: function (n) { setEarnings(n); refreshAll(); },
        isThresholdReached: isThresholdReached,
        showThresholdModal: showThresholdModal,
        hideThresholdModal: hideThresholdModal,
        showDailyCapModal: showDailyCapModal,
        hideDailyCapModal: hideDailyCapModal,
        showKeepEarningModal: showKeepEarningModal,
        hideKeepEarningModal: hideKeepEarningModal,
        isDailyCapReached: isDailyCapReached,
        checkDailyEarnCap: isDailyCapReached,
        isDailyCapReachedSync: isDailyCapReachedSync,
        isDailyEarnCapEnabled: isDailyEarnCapEnabled,
        getDailyEarnCapAmount: getDailyEarnCapAmount,
        resolveTodayEarnedFromUserTasks: resolveTodayEarnedFromUserTasks,
        loadConfig: loadTaskVestConfig,
        loadTaskVestConfig: loadTaskVestConfig,
        syncTasksFromSupabase: syncTasksFromSupabase,
        syncBalanceFromSupabase: syncBalanceFromSupabase,
        formatMoney: money,
        money: money,
        getActiveCurrency: getActiveCurrency,
        refresh: refreshAll,
        refreshAll: refreshAll,
        constants: CONST,
        CONST: CONST,
        startCall: startCall,
        showFavPopup: showFavPopup,
        showVerify: showVerify,
        showGate: showGate,
        showEsimModal: showEsimModal,
        showWelcomeModal: showWelcomeModal,
        hideWelcomeModal: hideWelcomeModal,
        showAdminModal: showAdminModal,
        injectAdminControls: injectAdminControls,
        isAdmin: isAdmin,
        withdrawals: withdrawals,
        favorites: favorites,
        wireBankAccount: wireBankAccount,
        callHistory: function () { return callData().history; }
    };
    window.wireBankAccount = wireBankAccount;
    window.NUALT_BANKS = NUALT_BANKS;
    window.openAdminSettings = showAdminModal;
})();
