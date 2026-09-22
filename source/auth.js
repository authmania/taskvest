/*
 * TaskVest — static clone runtime
 * ---------------------------------------------------------------
 * One file powers the whole local-only experience:
 *
 *   • Disarms Laravel Livewire (no server needed)
 *   • Provides a localStorage-backed data layer (users, session,
 *     balances, transactions, claims, settings, messages)
 *   • Wires every form via [data-auth] / wire:submit / data-action
 *   • Wires every button via [data-action="…"] (claim, claimAll,
 *     setFilter, showDetails, switchTo, save, etc.)
 *   • Personalises every page with the logged-in user's data
 *
 * Include on every page:
 *   <script src="<root-relative>auth.js" defer></script>
 *
 * The page picks behaviour from <body data-auth="…">:
 *   login       → wire login form (auto-redirects to dashboard if logged in)
 *   register    → wire register form (auto-redirects to dashboard if logged in)
 *   protected   → redirect to /auth/login.html if no session
 *
 * Beyond that, *all* forms with a submit action and *all* elements
 * with [data-action] are auto-wired regardless of data-auth.
 */

(function () {
    'use strict';

    // Safe Livewire stub in case any component or listener expects it
    if (typeof window !== 'undefined') {
        window.Livewire = window.Livewire || {
            on: function () {},
            dispatch: function () {},
            hook: function () {},
            start: function () {},
            find: function () { return null; }
        };
    }

    /* ====================================================================
     * 1. STORAGE LAYER
     * ==================================================================== */

    var K = {
        USERS:        'nx_users',         // [{…user, password}]
        SESSION:      'nx_session',       // {…user, loginAt}
        TX:           'nx_transactions',  // [{id, type, label, amount, wallet, status, ts, details}]
        CLAIMS:       'nx_claims',        // [txId] claimed transaction IDs
        BALANCE_HIDE: 'nx_hide_balance',  // bool
        SETTINGS:     'nx_settings',      // {currency, pin, …per-user}
        TOKENS:       'nx_copied_tokens', // [token]
        MESSAGES:     'nx_messages'       // [{id, from, preview, ts, read}]
    };

    var USER_SCOPED = ['nx_transactions','nx_created_at','nx_total_earnings','nx_account_active','nx_esim_plan','nx_withdrawals','nx_call_data','nx_favorites','nx_favorite_limit','nx_saved_contacts','nx_daily_earned'];
    function nxUserId() {
        try { var s = JSON.parse(localStorage.getItem(K.SESSION) || 'null'); return (s && (s.id || s.userId || s.email)) || ''; }
        catch (_) { return ''; }
    }
    function nxUserKey(base) { var u = nxUserId(); return u ? (base + '_' + u) : base; }
    window.nxUserKey = nxUserKey;
    function scopedKey(key) { return USER_SCOPED.indexOf(key) !== -1 ? nxUserKey(key) : key; }

    function get(key, fallback) {
        try { var v = localStorage.getItem(scopedKey(key)); return v == null ? fallback : JSON.parse(v); }
        catch (_) { return fallback; }
    }
    function set(key, value) { localStorage.setItem(scopedKey(key), JSON.stringify(value)); }
    function unset(key) { localStorage.removeItem(scopedKey(key)); }

    var store = {
        // Users
        users:   function () { return get(K.USERS, []); },
        addUser: function (u) { var l = store.users(); l.push(u); set(K.USERS, l); return u; },
        findUser:function (test) { return store.users().filter(test)[0] || null; },

        // Session
        session: function () { return get(K.SESSION, null); },
        login:   function (u) { set(K.SESSION, Object.assign({}, u, { loginAt: Date.now() })); },
        logout:  function () { unset(K.SESSION); localStorage.removeItem('nx_is_admin'); },

        // Transactions
        txs:          function () { return get(K.TX, []); },
        transactions: function () { return get(K.TX, []); },
        addTx:        function (t) {
            var l = store.txs();
            var now = Date.now();
            var isDup = l.some(function (item) {
                return item.type === t.type &&
                       Number(item.amount) === Number(t.amount) &&
                       item.label === t.label &&
                       (now - (Number(item.ts) || now)) < 6000;
            });
            if (isDup) return l[0];
            var tx = Object.assign({ id: uid(), ts: now, status: 'completed' }, t);
            l.unshift(tx);
            set(K.TX, l);
            return tx;
        },
        addTransaction: function (t) { return store.addTx(t); },
        updateTx:function (id, patch) {
            var l = store.txs().map(function (t) { return t.id === id ? Object.assign(t, patch) : t; });
            set(K.TX, l);
        },
        findTx:  function (id) { return store.txs().filter(function (t) { return t.id === id; })[0] || null; },

        // Claims
        claims:    function () { return get(K.CLAIMS, []); },
        isClaimed: function (txId) { return store.claims().indexOf(txId) !== -1; },
        markClaimed:function (txId) {
            var c = store.claims(); if (c.indexOf(txId) === -1) { c.push(txId); set(K.CLAIMS, c); }
        },

        // Settings
        settings: function () {
            var curr = 'NGN';
            try {
                curr = localStorage.getItem('nx_system_currency') || 'NGN';
                var st = localStorage.getItem('nx_system_settings');
                if (st) {
                    var parsed = JSON.parse(st);
                    if (parsed.currency) curr = parsed.currency;
                }
            } catch (_) {}
            var sym = curr === 'USD' ? '$' : '₦';
            return get(K.SETTINGS, { currency: curr, rate: curr === 'USD' ? 0.001 : 1, symbol: sym });
        },
        saveSettings: function (patch) { set(K.SETTINGS, Object.assign(store.settings(), patch)); },

        // Misc
        balanceHidden: function (v) {
            if (v === undefined) return get(K.BALANCE_HIDE, false);
            set(K.BALANCE_HIDE, !!v);
        },
        addCopiedToken: function (tok) {
            var l = get(K.TOKENS, []); if (l.indexOf(tok) === -1) { l.unshift(tok); set(K.TOKENS, l.slice(0, 50)); }
        }
    };

    function uid() { return 'nx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

    function money(n) {
        var num = Number(n) || 0;
        var curr = 'NGN';
        try {
            curr = localStorage.getItem('nx_system_currency') || 'NGN';
            var st = localStorage.getItem('nx_system_settings');
            if (st) {
                var parsed = JSON.parse(st);
                if (parsed.currency) curr = parsed.currency;
            }
        } catch (_) {}

        if (curr === 'USD') {
            var usdVal = num / 1000;
            return '$' + usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return '₦' + Math.round(num).toLocaleString('en-US');
    }
    window.formatMoney = money;

    /* ====================================================================
     * 2. SEED DATA (only on first run)
     * ==================================================================== */

    function seed() {
        if (get('nx_seeded', false)) return;
        set('nx_seeded', true);
    }

    /* ====================================================================
     * 3. UTIL
     * ==================================================================== */

    var scriptTag = document.currentScript;
    function scriptSrc() { return scriptTag ? (scriptTag.src || '') : ''; }
    function computeRoot() {
        var a = document.createElement('a'); a.href = scriptSrc();
        var p = a.pathname.replace(/\/auth\.js(\?.*)?$/, '/');
        if (!p.endsWith('/')) p += '/';
        return p;
    }
    var ROOT = computeRoot();
    function url(path) { return ROOT + path.replace(/^\//, ''); }
    function loginUrl() { return url('auth/login.html'); }
    function dashUrl()  { return url('dashboard.html'); }

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    function val(ctx, name) {
        var el = ctx.querySelector('[data-model="' + name + '"], [name="' + name + '"]');
        if (!el) {
            if (name === 'login') {
                el = ctx.querySelector('input[name="login"], input[name="email"], input[autocomplete="username"], input[type="email"], input[type="text"]');
            } else if (name === 'fullName' || name === 'name') {
                el = ctx.querySelector('input[name="fullName"], input[name="name"], input[autocomplete="name"], input[placeholder*="Name" i]');
            } else if (name === 'email') {
                el = ctx.querySelector('input[name="email"], input[type="email"], input[autocomplete="email"], input[placeholder*="email" i]');
            } else if (name === 'username') {
                el = ctx.querySelector('input[name="username"], input[placeholder*="username" i]');
            } else if (name === 'phone') {
                el = ctx.querySelector('input[name="phone"], input[type="tel"], input[autocomplete="tel"], input[placeholder*="phone" i]');
            } else if (name === 'country') {
                el = ctx.querySelector('select[name="country"], select');
            } else if (name === 'password') {
                var pws = ctx.querySelectorAll('input[type="password"]');
                if (pws.length > 0) el = pws[0];
                else el = ctx.querySelector('input[name="password"], input[autocomplete="new-password"], input[autocomplete="current-password"]');
            } else if (name === 'password_confirmation' || name === 'confirmPassword') {
                var allPws = ctx.querySelectorAll('input[type="password"]');
                if (allPws.length > 1) el = allPws[1];
                else el = ctx.querySelector('input[name="password_confirmation"], input[name="confirmPassword"]');
            }
        }
        if (!el) return '';
        return (el.value != null ? el.value : el.textContent || '').trim();
    }
    function isChecked(ctx, name) {
        var el = ctx.querySelector('[data-model="' + name + '"], [name="' + name + '"]');
        if (!el) {
            el = ctx.querySelector('input[type="checkbox"]');
        }
        return !!(el && el.checked);
    }

    function toast(msg, type) {
        type = type || 'success';
        var colors = { success: 'bg-success/10 text-success', error: 'bg-danger/10 text-danger', info: 'bg-primary/10 text-primary' };
        var box = document.createElement('div');
        box.className = 'fixed top-4 inset-x-0 z-[200] mx-auto w-[90%] max-w-sm rounded-[14px] px-4 py-3 font-sans text-[14px] shadow-lg ' + (colors[type] || colors.success);
        box.textContent = msg;
        document.body.appendChild(box);
        setTimeout(function () { box.style.transition = 'opacity .3s'; box.style.opacity = '0'; setTimeout(function () { box.remove(); }, 300); }, 2500);
    }

    /* ====================================================================
     * 4. DISARM LIVEWIRE (but keep Alpine!)
     * ==================================================================== */

    var _livewireStubbed = false;
    function stubLivewire() {
        if (_livewireStubbed) return;
        var L = window.Livewire;
        if (!L) return;
        _livewireStubbed = true;
        try {
            if (L.find)  L.find  = function () { return stubComponent(); };
            if (L.first) L.first = function () { return stubComponent(); };
            if (L.navigate) L.navigate = function (url) { if (url) location.href = url; };
            if (L.dispatch) L.dispatch = function () {};
            if (L.hook)   L.hook   = function () {};
            if (L.on)     L.on     = function () {};
        } catch (_) {}
    }
    function stubComponent() {
        return {
            $call: function () {}, $set: function () {}, $toggle: function () {},
            entangle: function () { return { get: function () { return null; }, set: function () {} }; },
            $commit: function () {}, $refresh: function () {}
        };
    }

    function disarmLivewire() {
        $all('[wire\\:loading]').forEach(function (el) {
            if (!el.hasAttribute('wire:loading.remove') &&
                !el.hasAttribute('wire:loading.delay')) {
                el.remove();
            }
        });
        $all('[wire\\:model]').forEach(function (el) {
            var m = el.getAttribute('wire:model') || '';
            m = m.split('.')[0];
            el.setAttribute('data-model', m);
        });
        $all('[wire\\:click]').forEach(function (el) {
            el.setAttribute('data-action', el.getAttribute('wire:click'));
        });
        $all('form[wire\\:submit]').forEach(function (el) {
            el.setAttribute('data-action', el.getAttribute('wire:submit'));
        });
        $all('*').forEach(function (el) {
            var attrs = el.attributes;
            for (var i = attrs.length - 1; i >= 0; i--) {
                if (/^wire:/.test(attrs[i].name)) el.removeAttribute(attrs[i].name);
            }
        });
        stubLivewire();
        document.addEventListener('alpine:init', stubLivewire);
    }

    /* ====================================================================
     * 5. LOGOUT (all pages)
     * ==================================================================== */

    function wireLogout() {
        $all('form').forEach(function (form) {
            var action = form.getAttribute('action') || '';
            if (/#logout/i.test(action) || /\/logout/i.test(action)) {
                form.addEventListener('submit', function (e) {
                    e.preventDefault(); e.stopPropagation();
                    store.logout();
                    window.location.href = loginUrl();
                }, true);
            }
        });
    }

    /* ====================================================================
     * 6. FORM HANDLERS
     * ==================================================================== */

    function showError(form, msg) {
        form.querySelectorAll('[data-auth-error]').forEach(function (n) { n.remove(); });
        var box = document.createElement('div');
        box.className = 'w-full rounded-[12px] bg-danger/10 text-danger px-4 py-3 font-sans text-[13px]';
        box.setAttribute('data-auth-error', '');
        box.textContent = msg;
        form.insertBefore(box, form.firstChild);
    }

    function wireLogin() {
        var form = $('form[data-action="authenticate"]') || $('form');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var id = val(form, 'login'), pw = val(form, 'password');
            if (!id || !pw) return showError(form, 'Please enter your email/username and password.');

            var key = String(id).trim().toLowerCase();
            var digits = key.replace(/\D/g, '');
            var user = store.findUser(function (u) {
                return (u.email && String(u.email).toLowerCase() === key) ||
                       (u.username && String(u.username).toLowerCase() === key) ||
                       (digits && u.phone && String(u.phone).replace(/\D/g, '') === digits);
            });
            if (!user) return showError(form, 'No account found with that email or username.');
            if (String(user.password || '') !== String(pw)) return showError(form, 'Incorrect password. Please try again.');

            store.login(user);
            localStorage.setItem(nxUserKey('nx_created_at'), String(user.createdAt || user.created_at || new Date().toISOString()));
            localStorage.setItem('nx_is_admin', (user.isAdmin || user.is_admin) ? '1' : '0');
            localStorage.setItem(nxUserKey('nx_total_earnings'), String(user.balance != null ? user.balance : 0));
            localStorage.setItem(nxUserKey('nx_account_active'), (user.accountActive || user.account_active) ? 'true' : 'false');

            var bounce = sessionStorage.getItem('nx_redirect');
            if (bounce) { sessionStorage.removeItem('nx_redirect'); window.location.href = bounce; }
            else window.location.href = dashUrl();
        }, true);
    }

    function wireRegister() {
        var form = $('form[data-action="register"]') || $('form');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var fullName = val(form, 'fullName'),
                email    = val(form, 'email').toLowerCase(),
                username = val(form, 'username'),
                phone    = val(form, 'phone'),
                country  = val(form, 'country'),
                password = val(form, 'password'),
                confirm  = val(form, 'password_confirmation'),
                agree    = isChecked(form, 'agreeTerms');

            if (!fullName || !email || !username || !phone || !password) {
                return showError(form, 'Please fill in all required fields.');
            }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                return showError(form, 'Please enter a valid email address.');
            }
            if (username.length < 3) {
                return showError(form, 'Username must be at least 3 characters.');
            }
            if (password.length < 6) {
                return showError(form, 'Password must be at least 6 characters.');
            }
            if (password !== confirm) {
                return showError(form, 'Passwords do not match.');
            }
            if (!agree) return showError(form, 'You must agree to the Terms & Conditions to continue.');

            var dup = store.findUser(function (u) {
                return (u.email && String(u.email).toLowerCase() === email) ||
                       (u.username && String(u.username).toLowerCase() === username.toLowerCase());
            });
            if (dup) return showError(form, 'An account with this email or username already exists.');

            var WELCOME = 200000;
            try {
                var _cfg = JSON.parse(localStorage.getItem('nx_system_settings') || '{}');
                var _wb = _cfg.welcomeBalance != null ? _cfg.welcomeBalance : _cfg.welcome_balance;
                if (_wb != null && Number(_wb) > 0) WELCOME = Number(_wb);
            } catch (_) {}
            var now = new Date().toISOString();
            var u = {
                id: uid(), fullName: fullName, email: email, username: username,
                phone: phone, country: country || 'Nigeria', password: password,
                accountActive: false, account_active: false,
                balance: WELCOME, lifetimeEarnings: WELCOME, lifetime_earnings: WELCOME,
                createdAt: now, created_at: now, isAdmin: false
            };
            store.addUser(u);
            store.login(u);
            localStorage.setItem(nxUserKey('nx_created_at'), now);
            localStorage.setItem(nxUserKey('nx_total_earnings'), String(WELCOME));
            localStorage.setItem(nxUserKey('nx_account_active'), 'false');
            localStorage.setItem('nx_active', 'false');
            store.addTx({ label: '₦' + WELCOME.toLocaleString() + ' welcome bonus', amount: WELCOME, wallet: 'referral_bonus', type: 'earn' });
            localStorage.setItem('nx_show_welcome', '1');
            window.location.href = dashUrl();
        }, true);
    }

    function wireForgotPassword() {
        var form = $('form[data-action="sendReset"]') || $('form');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var email = val(form, 'email');
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                return showError(form, 'Please enter a valid email.');
            }
            toast('If that email exists, a reset link has been sent.');
            setTimeout(function () { window.location.href = loginUrl(); }, 1500);
        }, true);
    }

    function wireVerifyToken() {
        var form = $('form[data-action="verify"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var code = val(form, 'code');
            if (!code) return showError(form, 'Please enter your token.');
            toast('Token verified successfully.');
            setTimeout(function () { window.location.href = url('agents.html'); }, 1500);
        }, true);
    }

    function wireContact() {
        var form = $('form[data-action="submit"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (!val(form, 'name') || !val(form, 'email') || !val(form, 'message')) {
                return showError(form, 'Please complete all fields.');
            }
            toast('Message sent. We will be in touch shortly.');
            form.reset();
        }, true);
    }

    function wireChangePin() {
        var form = $('form[data-action="proceed"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var cur = val(form, 'currentPin'), neu = val(form, 'newPin'), conf = val(form, 'confirmPin');
            var s = store.settings();
            if (s.pin && cur !== s.pin) return showError(form, 'Current PIN is incorrect.');
            if (!/^\d{4}$/.test(neu)) return showError(form, 'New PIN must be 4 digits.');
            if (neu !== conf) return showError(form, 'PINs do not match.');
            store.saveSettings({ pin: neu });
            toast('PIN changed successfully.');
            form.reset();
        }, true);
    }

    function wireResetPin() {
        var form = $('form[data-action="proceed"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
            e.preventDefault(); e.stopPropagation();
            var token = val(form, 'token'), neu = val(form, 'newPin'), conf = val(form, 'confirmPin');
            if (!token) return showError(form, 'Please enter the token from your email.');
            if (!/^\d{4}$/.test(neu)) return showError(form, 'New PIN must be 4 digits.');
            if (neu !== conf) return showError(form, 'PINs do not match.');
            store.saveSettings({ pin: neu });
            toast('PIN reset successfully.');
            setTimeout(function () { window.location.href = loginUrl(); }, 1500);
        }, true);
    }

    function wireSaveSettings(action) {
        $all('form[data-action="' + action + '"]').forEach(function (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault(); e.stopPropagation();
                var s = store.session() || {};
                var patch = {};
                $all('[data-model]', form).forEach(function (el) {
                    var name = el.getAttribute('data-model');
                    patch[name] = el.value;
                });
                if (action === 'save' && form.querySelector('[data-model="first_name"]')) {
                    var newUser = Object.assign({}, s, {
                        fullName: (patch.first_name || '') + ' ' + (patch.last_name || ''),
                        phone: patch.phone || s.phone,
                        telegram: patch.telegram,
                        biography: patch.biography
                    });
                    store.login(newUser);
                    updateUsersRecord(newUser);
                } else if (action === 'save' && form.querySelector('[data-model="current_password"]')) {
                    if (patch.current_password !== (s.password || '')) {
                        return showError(form, 'Current password is incorrect.');
                    }
                    if (patch.password !== patch.password_confirmation) {
                        return showError(form, 'Passwords do not match.');
                    }
                    var updated = Object.assign({}, s, { password: patch.password });
                    store.login(updated);
                    updateUsersRecord(updated);
                } else if (action === 'save' && form.querySelector('[data-model="bankId"]')) {
                    store.saveSettings({ bankId: patch.bankId });
                }
                toast('Saved successfully.');
            }, true);
        });
    }

    function wireRewardCustom() {
        $all('[data-action="saveCustom"]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                var input = el.closest('div').querySelector('input[type="number"]');
                if (input) {
                    store.saveSettings({ customRewardTarget: parseFloat(input.value) || 0 });
                    toast('Custom reward target saved.');
                }
            }, true);
        });
    }

    function updateUsersRecord(patch) {
        var list = store.users().map(function (u) {
            return (u.email === patch.email || u.username === patch.username) ? Object.assign({}, u, patch) : u;
        });
        set(K.USERS, list);
    }

    /* ====================================================================
     * 7. ACTION BUTTONS  (data-action="…")
     * ==================================================================== */

    function wireActions() {
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-action]');
            if (!el) return;
            var action = el.getAttribute('data-action') || '';
            var parts = action.match(/^(\w+)(?:\((.*)\))?$/);
            if (!parts) return;
            var name = parts[1];
            var arg  = parts[2] ? parts[2].replace(/^['"]|['"]$/g, '') : null;

            switch (name) {
                case 'claim':       doClaim(el, arg); break;
                case 'claimAll':    doClaimAll(el);   break;
                case 'setFilter':   doFilter(el, arg); break;
                case 'switchTo':    doSwitchCurrency(el, arg); break;
                case 'showDetails': doShowDetails(el, arg); break;
                case 'showMember':  toast('Member profile'); break;
                case 'viewToken':   doCopyToken(el, arg); break;
                case 'startChat':   toast('Opening chat…'); break;
                case 'addNumber':   toast('Number added to your Cloud plan.'); break;
                case 'nextPage':    toast('No more results.'); break;
                case 'selectTab':   doTab(el, arg); break;
                case 'openGenerate':toast('Generation started.'); break;
                case 'startRequest':toast('Request submitted.'); break;
                case 'apply':       toast('Application submitted.'); break;
                case 'TaskVestCopy':  break;
            }
        }, true);

        // Global check for landing page / auth links if already logged in
        document.addEventListener('click', function (e) {
            var a = e.target.closest('a');
            if (!a) return;
            var href = a.getAttribute('href') || '';
            if (href && (href.indexOf('login.html') !== -1 || href.indexOf('register.html') !== -1)) {
                var s = store.session();
                if (s && (s.email || s.username || s.id)) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = dashUrl();
                }
            }
        }, true);
    }

    function isClaimThresholdReached() {
        if (typeof window.TaskVestTasks !== 'undefined' && typeof window.TaskVestTasks.isThresholdReached === 'function') {
            return window.TaskVestTasks.isThresholdReached();
        }
        var s = store.session() || {};
        var isAct = !!(s.accountActive || s.account_active || localStorage.getItem(nxUserKey('nx_account_active')) === 'true' || localStorage.getItem('TaskVest_account_active') === 'true');
        if (isAct) return false;
        var maxEarnings = 50000;
        try {
            var cfg = JSON.parse(localStorage.getItem('nx_system_settings') || '{}');
            if (cfg.maxEarnings || cfg.max_earnings) {
                maxEarnings = Number(cfg.maxEarnings || cfg.max_earnings) || 50000;
            }
        } catch (_) {}
        var curBal = Number(s.balance != null ? s.balance : (localStorage.getItem('TaskVest_earnings') || localStorage.getItem('nx_earnings') || 0));
        return curBal >= maxEarnings;
    }

    function doClaim(el, txId) {
        if (txId && store.isClaimed(txId)) {
            el.disabled = true;
            el.classList.add('opacity-50');
            toast('Already claimed.', 'info');
            return;
        }
        if (isClaimThresholdReached()) {
            if (typeof window.TaskVestTasks !== 'undefined' && typeof window.TaskVestTasks.showThresholdModal === 'function') {
                window.TaskVestTasks.showThresholdModal();
            } else {
                toast('Maximum earnings reached. Please activate your account.', 'warning');
            }
            return;
        }
        var amt = 1028;
        if (txId) store.markClaimed(txId);
        if (el.tagName === 'BUTTON') {
            el.disabled = true;
            el.textContent = 'Claimed';
            el.classList.add('opacity-50');
        }
        if (typeof window.TaskVestTasks !== 'undefined' && typeof window.TaskVestTasks.addEarnings === 'function') {
            window.TaskVestTasks.addEarnings(amt, 'Claimed earning', 'total');
        } else {
            store.addTx({ label: 'Claimed earning', amount: amt, wallet: 'total', type: 'earn' });
            bumpBalance('total', amt);
            bumpBalance('lifetime', amt);
        }
        toast('Claimed ' + money(amt) + ' successfully.');
    }

    function doClaimAll(el) {
        if (isClaimThresholdReached()) {
            if (typeof window.TaskVestTasks !== 'undefined' && typeof window.TaskVestTasks.showThresholdModal === 'function') {
                window.TaskVestTasks.showThresholdModal();
            } else {
                toast('Maximum earnings reached. Please activate your account.', 'warning');
            }
            return;
        }
        var count = 0, total = 0;
        $all('[data-action^="claim("]').forEach(function (btn) {
            if (isClaimThresholdReached()) return;
            var id = (btn.getAttribute('data-action').match(/claim\(['"]([^'"]+)/) || [])[1];
            if (id && !store.isClaimed(id) && !btn.disabled) {
                store.markClaimed(id);
                btn.disabled = true; btn.textContent = 'Claimed'; btn.classList.add('opacity-50');
                count++; total += 1028;
            }
        });
        if (count === 0) { toast('Nothing to claim.', 'info'); return; }
        if (typeof window.TaskVestTasks !== 'undefined' && typeof window.TaskVestTasks.addEarnings === 'function') {
            window.TaskVestTasks.addEarnings(total, 'Claimed earnings (' + count + ')', 'total');
        } else {
            store.addTx({ label: 'Claimed earning', amount: total, wallet: 'total', type: 'earn' });
            bumpBalance('total', total);
            bumpBalance('lifetime', total);
        }
        toast('Claimed ' + count + ' earnings (' + money(total) + ').');
    }

    function doFilter(el, filter) {
        var group = el.parentElement;
        $all('button', group).forEach(function (b) { b.classList.remove('bg-primary','text-surface'); b.classList.add('bg-surface'); });
        el.classList.add('bg-primary','text-surface'); el.classList.remove('bg-surface');
        $all('[data-tx-type]').forEach(function (row) {
            var t = row.getAttribute('data-tx-type');
            row.style.display = (filter === 'all' || t === filter) ? '' : 'none';
        });
        toast('Filtering: ' + filter, 'info');
    }

    function doSwitchCurrency(el, cur) {
        var rates = { USD: { rate: 0.001, symbol: '$' }, NGN: { rate: 1, symbol: '₦' } };
        var r = rates[cur] || rates.USD;
        localStorage.setItem('nx_system_currency', cur);
        store.saveSettings(r);
        $all('[data-money]').forEach(function (node) {
            var base = parseFloat(node.getAttribute('data-money'));
            if (!isNaN(base)) node.textContent = money(base);
        });
        var dropdown = el.closest('[x-data]');
        if (dropdown && dropdown._x_dataStack) {
            try { dropdown._x_dataStack[0].open = false; } catch (_) {}
        }
        toast('Switched to ' + cur, 'info');
        if (window.TaskVestTasks && window.TaskVestTasks.refreshAll) {
            window.TaskVestTasks.refreshAll();
        }
    }

    function doShowDetails(el, txId) {
        var row = el.closest('[data-tx-type]') || el.closest('div');
        if (!row) return;
        var panel = row.querySelector('[data-detail-panel]');
        if (panel) { panel.style.display = panel.style.display === 'none' ? '' : 'none'; return; }
        var tx = store.findTx(txId) || { label: 'Transaction', amount: 0, status: 'completed' };
        panel = document.createElement('div');
        panel.setAttribute('data-detail-panel', '');
        panel.className = 'mt-3 rounded-[12px] bg-surface p-4 font-sans text-[13px] text-text';
        panel.innerHTML =
            '<div class="flex justify-between mb-2"><span class="text-muted">Reference</span><span class="font-mono">' + tx.id + '</span></div>' +
            '<div class="flex justify-between mb-2"><span class="text-muted">Description</span><span>' + (tx.label || '') + '</span></div>' +
            '<div class="flex justify-between mb-2"><span class="text-muted">Amount</span><span>' + money(tx.amount) + '</span></div>' +
            '<div class="flex justify-between"><span class="text-muted">Status</span><span class="text-success capitalize">' + tx.status + '</span></div>';
        row.appendChild(panel);
    }

    function doCopyToken(el, token) {
        store.addCopiedToken(token);
        if (navigator.clipboard) navigator.clipboard.writeText(token);
        var label = el.querySelector('span');
        var original = label ? label.textContent : '';
        if (label) label.textContent = 'Copied!';
        setTimeout(function () { if (label) label.textContent = original; }, 1500);
    }

    function doTab(el, tab) {
        var group = el.parentElement;
        $all('button, a', group).forEach(function (b) {
            b.classList.remove('bg-white/15','text-secondary'); b.classList.add('text-white/80');
        });
        el.classList.add('bg-white/15','text-secondary'); el.classList.remove('text-white/80');
    }

    /* ====================================================================
     * 8. BALANCE RENDERING
     * ==================================================================== */

    function computeBalances() {
        var txs = store.txs();
        var s = store.session() || {};
        var storedEarn = Number(localStorage.getItem(nxUserKey('nx_total_earnings')));
        var liveBalance = 0;
        if (s.balance != null && !isNaN(s.balance)) {
            liveBalance = Number(s.balance);
        } else if (!isNaN(storedEarn)) {
            liveBalance = storedEarn;
        }

        var liveLifetime = liveBalance;
        if (s.lifetimeEarnings != null && !isNaN(s.lifetimeEarnings)) {
            liveLifetime = Number(s.lifetimeEarnings);
        } else if (s.lifetime_earnings != null && !isNaN(s.lifetime_earnings)) {
            liveLifetime = Number(s.lifetime_earnings);
        }

        var wallets = { lifetime: 0, total: 0, survey: 0, music: 0,
                        referral_bonus: 0, reward: 0, bonus: 0, extra: 0 };
        var totalEarnFromTxs = 0;
        var seenKeys = {};

        txs.forEach(function (t) {
            if (!t || t.type !== 'earn') return;
            var k = t.id || ((t.label || '') + '|' + (t.amount || ''));
            if (seenKeys[k]) return;
            seenKeys[k] = true;

            var w = t.wallet || 'total';
            var amt = Number(t.amount) || 0;
            if (wallets[w] != null) wallets[w] += amt;
            if (w !== 'lifetime') {
                totalEarnFromTxs += amt;
            }
        });

        // Set total balance and lifetime balance cleanly
        wallets.total = liveBalance;
        wallets.lifetime = liveLifetime;
        if (wallets.referral_bonus === 0 && liveBalance > 0) {
            wallets.referral_bonus = liveBalance;
        }

        return [
            { label: 'Total Balance',   amount: liveBalance,            wallet: 'total',           exact: liveBalance },
            { label: 'Current Balance', amount: liveBalance,           wallet: 'total',           exact: liveBalance,  today: 0 },
            { label: 'Surveys',         amount: wallets.survey,         wallet: 'survey',          exact: wallets.survey, today: 0 },
            { label: 'Music Tasks',     amount: wallets.music,          wallet: 'music',           exact: wallets.music, today: 0 },
            { label: 'Referral Bonus',  amount: wallets.referral_bonus,wallet: 'referral_bonus',  exact: wallets.referral_bonus, today: 0 },
            { label: 'Welcome Bonus',   amount: wallets.reward,        wallet: 'reward',          exact: wallets.reward, today: 0 },
            { label: 'Task Rewards',    amount: wallets.bonus,         wallet: 'bonus',           exact: wallets.bonus, today: 0 },
            { label: 'Extra Earnings',  amount: wallets.extra,         wallet: 'extra',           exact: wallets.extra, today: 0 }
        ];
    }

    function bumpBalance(wallet, delta) {
        renderBalances();
    }

    function renderBalances() {
        var rawBalances = computeBalances();
        var live = rawBalances.map(function (b) {
            return {
                label:  b.label,
                amount: money(b.amount),
                exact:  money(b.exact),
                today:  b.today != null ? money(b.today) : null,
                wallet: b.wallet
            };
        });

        // 1. Update Alpine.js reactive data stack
        $all('[x-data]').forEach(function (el) {
            var src = el.getAttribute('x-data') || '';
            if (!/balances\s*:/.test(src) && !el._x_dataStack) return;
            if (!el._x_dataStack) return;
            try {
                var data = el._x_dataStack[0];
                if (data && Array.isArray(data.balances)) {
                    data.balances = live.map(function (item) { return Object.assign({}, item); });
                    if (data.i >= live.length) data.i = 0;
                }
            } catch (_) {}
        });

        // 2. Dispatch custom events so Alpine x-init and custom listeners update instantly
        try {
            window.dispatchEvent(new CustomEvent('nx-balances-changed', { detail: live }));
            window.dispatchEvent(new CustomEvent('nx-balance-updated', { detail: live }));
        } catch (_) {}

        // 3. Direct DOM node updates for instant visual reflection
        var currAmt = live[1] ? live[1].amount : (live[0] ? live[0].amount : '');
        var exactAmt = live[1] ? live[1].exact : (live[0] ? live[0].exact : '');
        var totalAmt = live[0] ? live[0].amount : currAmt;

        $all('[data-nx-wd-balance]').forEach(function (el) { el.textContent = currAmt; });
        $all('[data-nx-threshold-balance]').forEach(function (el) { el.textContent = currAmt; });
        $all('[data-nx-current-balance]').forEach(function (el) { el.textContent = currAmt; });
        $all('[data-nx-total-balance]').forEach(function (el) { el.textContent = totalAmt; });
    }

    /* ====================================================================
     * 9. PROTECTED PAGES — guard + personalise
     * ==================================================================== */

    function guard() {
        var s = store.session();
        if (!s) {
            try { sessionStorage.setItem('nx_redirect', window.location.pathname + window.location.hash); } catch (_) {}
            window.location.replace(loginUrl());
            return;
        }
        personalise(s);
        renderBalances();
        renderTransactions();

        // Background sync to fetch fresh Supabase profile data, balance, transactions, and tasks
        syncCurrentUserProfile();
    }

    function personalise(user) {
        var first = (user.fullName || '').split(/\s+/)[0] || user.username || 'there';
        $all('p.font-heading.font-medium.truncate').forEach(function (p) {
            if (/^Hi,/.test(p.textContent)) p.textContent = 'Hi, ' + first;
        });
        $all('.block.font-heading.font-medium.text-white').forEach(function (p) {
            if (/Bobby Emmanuel/.test(p.textContent)) p.textContent = user.fullName || 'Bobby Emmanuel';
        });
        $all('.block.font-sans.text-white\\/55').forEach(function (p) {
            if (/Royal eSIM/.test(p.textContent)) p.textContent = user.email || user.username || '';
        });
        setInput('[data-model="first_name"]',  (user.fullName || '').split(/\s+/)[0]);
        setInput('[data-model="last_name"]',   (user.fullName || '').split(/\s+/).slice(1).join(' '));
        setInput('[data-model="phone"]',       user.phone || '');
        var avatar = document.querySelector('[data-nx-avatar]');
        if (avatar) avatar.textContent = (user.fullName || 'U').charAt(0).toUpperCase();
        var fullNameEl = document.querySelector('[data-nx-fullname]');
        if (fullNameEl) fullNameEl.textContent = user.fullName || 'User';
        var userInfoEl = document.querySelector('[data-nx-userinfo]');
        if (userInfoEl) userInfoEl.textContent = '@' + (user.username || 'user') + (user.email ? ' · ' + user.email : '');
        var unameDisplay = document.querySelector('[data-model="username-display"]');
        if (unameDisplay) unameDisplay.textContent = '@' + (user.username || 'user');
        var emailDisplay = document.querySelector('[data-model="email-display"]');
        if (emailDisplay) emailDisplay.textContent = user.email || '';
        $all('[data-ref-code]').forEach(function (n) {
            n.textContent = (user.username || 'USER').toUpperCase();
        });
        $all('[data-ref-link]').forEach(function (n) {
            n.textContent = url('auth/register.html?ref=' + (user.username || '').toUpperCase());
        });
    }

    function setInput(sel, value) {
        var el = $(sel); if (el && el.value !== undefined && !el.value) el.value = value || '';
    }

    function renderTransactions() {
        var lists = $all('[data-tx-list]');
        if (!lists.length) return;
        var txs = store.txs().slice(0, 50);
        var html = txs.map(function (t) {
            var isEarn = t.type === 'earn';
            var color = isEarn ? 'success' : 'text';
            var icon  = isEarn ? 'ri-user-add-line' : 'ri-arrow-up-line';
            var sign  = isEarn ? '+' : '−';
            var date  = new Date(t.ts).toLocaleString(undefined, {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
            return '' +
              '<div data-tx-type="' + t.type + '" data-action="showDetails(\'' + t.id + '\')" ' +
                   'class="flex items-center gap-2.5 px-2.5 py-2.5 cursor-pointer rounded-[14px] hover:bg-background/60 transition-colors border-b border-muted/10">' +
                '<span class="size-[45px] rounded-full flex items-center justify-center shrink-0 bg-' + color + '/15 text-' + color + '">' +
                  '<i class="' + icon + ' text-[19px]"></i>' +
                '</span>' +
                '<div class="flex-1 min-w-0 flex flex-col">' +
                  '<p class="font-sans font-semibold text-[14px] text-' + color + '">' + sign +
                    '<span>' + money(t.amount) + '</span>' +
                  '</p>' +
                  '<p class="font-sans text-muted text-[12px] truncate">' + (t.label || '') + '</p>' +
                '</div>' +
                '<div class="flex flex-col items-end shrink-0 text-right">' +
                  '<p class="font-sans text-[12px] capitalize text-' + color + '">' + (t.status || 'completed') + '</p>' +
                  '<p class="font-sans text-muted text-[10px]">' + date + '</p>' +
                '</div>' +
              '</div>';
        }).join('') || '<p class="font-sans text-muted text-[13px] py-4 text-center">No transactions yet.</p>';

        lists.forEach(function (list) { list.innerHTML = html; });
    }

    /* ====================================================================
     * 10. CLIPBOARD HELPER (invite + agent batch pages)
     * ==================================================================== */

    window.TaskVestCopy = function (text) {
        return new Promise(function (resolve) {
            store.addCopiedToken(text);
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function () { resolve(true); }, function () { resolve(false); });
            } else {
                var ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); resolve(true); } catch (_) { resolve(false); }
                ta.remove();
            }
        });
    };

    /* ====================================================================
     * 11. BOOT
     * ==================================================================== */

    function earlyBoot() {
        seed();
        disarmLivewire();

        var s = store.session();
        var mode = document.body ? document.body.getAttribute('data-auth') : '';
        var path = window.location.pathname;

        // Auto redirect logged in user to dashboard if visiting auth or landing pages
        if (s && (s.email || s.username || s.id)) {
            if (mode === 'login' || mode === 'register' || path === '/' || path.endsWith('/index.html') || path.endsWith('/login.html') || path.endsWith('/register.html')) {
                window.location.replace(dashUrl());
                return;
            }
        }

        if (!window.NexAuth) {
            window.NexAuth = {
                store: store, money: money,
                balances: computeBalances,
                renderBalances: function () { renderBalances(); },
                renderTransactions: function () { renderTransactions(); },
                personalise: function (u) { personalise(u || store.session()); },
                syncCurrentUserProfile: function () { syncCurrentUserProfile(); },
                syncProfileNow: function (p) { syncProfileNow(p); },
                session: store.session, users: store.users, txs: store.txs,
                logout: function () { store.logout(); window.location.href = loginUrl(); },
                loginDemo: function () {
                    var u = { fullName: 'Demo User', username: 'demo', email: 'demo@TaskVest.local', phone: '+1 555 0000', country: 'US' };
                    store.login(u);
                    window.location.href = dashUrl();
                },
                reset: function () {
                    Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
                    localStorage.removeItem('nx_seeded');
                    location.reload();
                },
                addTx: function (label, amount, wallet, type) {
                    store.addTx({ label: label, amount: amount, wallet: wallet, type: type || 'earn' });
                    renderBalances(); renderTransactions();
                }
            };
        }
        patchBalanceAttrs();
    }

    function patchBalanceAttrs() {
        try {
            $all('[x-data]').forEach(function (el) {
                var src = el.getAttribute('x-data') || '';
                if (!/balances\s*:/.test(src)) return;
                try {
                    var live = JSON.stringify(computeBalances().map(function (b) {
                        return {
                            label:  b.label,
                            amount: money(b.amount),
                            exact:  money(b.exact),
                            today:  b.today != null ? money(b.today) : null,
                            wallet: b.wallet
                        };
                    }));
                    var newSrc = src.replace(
                        /balances\s*:\s*JSON\.parse\((?:'[^']*'|"[^"]*"|`[^`]*`|\[[\s\S]*?\]|[^\)]*)\)/,
                        'balances: ' + live
                    );
                    if (newSrc !== src) el.setAttribute('x-data', newSrc);

                    // Ensure x-init listens for instant updates without page refresh
                    var curInit = el.getAttribute('x-init') || '';
                    if (curInit.indexOf('nx-balances-changed') === -1) {
                        var extra = "window.addEventListener('nx-balances-changed', function(e) { if (e && e.detail) { balances = e.detail; } })";
                        el.setAttribute('x-init', curInit ? (curInit + '; ' + extra) : extra);
                    }
                } catch (_) {}
            });
        } catch (_) {}
    }

    document.addEventListener('alpine:init', patchBalanceAttrs);

    var _profileSyncTimer = null;
    function startProfileSyncLoop() {
        if (_profileSyncTimer) clearInterval(_profileSyncTimer);
        _profileSyncTimer = setInterval(function () {
            if (!document.hidden) {
                syncCurrentUserProfile();
            }
        }, 2500);
    }

    function boot() {
        wireLogout();
        wireActions();

        var mode = document.body.getAttribute('data-auth') || '';

        var s = store.session();
        if (s && (s.email || s.username || s.id)) {
            if (mode === 'login' || mode === 'register' || window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
                window.location.replace(dashUrl());
                return;
            }
        }

        switch (mode) {
            case 'login':          wireLogin(); break;
            case 'register':       wireRegister(); break;
            case 'protected':      guard(); break;
        }

        if ($('form[data-action="sendReset"]'))  wireForgotPassword();
        if ($('form[data-action="verify"]'))     wireVerifyToken();
        if ($('form[data-action="submit"]') && window.location.pathname.indexOf('contact') !== -1) wireContact();
        if ($('form[data-action="proceed"]')) {
            if ($('[data-model="token"]')) wireResetPin();
            else wireChangePin();
        }
        wireSaveSettings('save');
        wireRewardCustom();

        if (mode !== 'protected') {
            if (s) personalise(s);
        }

        // PWA Service Worker Registration
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        }

        syncCurrentUserProfile();
        startProfileSyncLoop();

        // Instant adaptation triggers
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) syncCurrentUserProfile();
        });
        window.addEventListener('focus', function () {
            syncCurrentUserProfile();
        });
        window.addEventListener('storage', function (e) {
            if (e.key === 'nx_session' || e.key === nxUserKey('nx_total_earnings') || e.key === nxUserKey('nx_account_active')) {
                var fresh = store.session();
                if (fresh) personalise(fresh);
                renderBalances();
                renderTransactions();
                if (window.TaskVestTasks && typeof window.TaskVestTasks.refresh === 'function') {
                    window.TaskVestTasks.refresh();
                }
            }
        });
    }

    function syncProfileNow(profileData) {
        if (!profileData) return;
        var s = store.session() || {};
        var liveBal = profileData.balance != null ? Number(profileData.balance) : (s.balance != null ? Number(s.balance) : 0);
        var liveLife = profileData.lifetime_earnings != null ? Number(profileData.lifetime_earnings) : (profileData.lifetimeEarnings != null ? Number(profileData.lifetimeEarnings) : (s.lifetimeEarnings || liveBal));
        var updated = Object.assign({}, s, {
            id: profileData.id || s.id,
            email: profileData.email || s.email,
            fullName: profileData.full_name || profileData.fullName || s.fullName,
            username: profileData.username || s.username,
            isAdmin: !!(profileData.is_admin || profileData.isAdmin),
            is_admin: !!(profileData.is_admin || profileData.isAdmin),
            accountActive: !!(profileData.account_active || profileData.accountActive),
            esimPlan: profileData.esim_plan || profileData.esimPlan || s.esimPlan,
            esimNumber: profileData.esim_number || profileData.esimNumber || s.esimNumber,
            balance: liveBal,
            lifetimeEarnings: liveLife,
            lifetime_earnings: liveLife,
            bankName: profileData.bank_name || profileData.bankName || s.bankName,
            bankAccountNumber: profileData.bank_account_number || profileData.bankAccountNumber || s.bankAccountNumber,
            bankAccountName: profileData.bank_account_name || profileData.bankAccountName || s.bankAccountName,
            createdAt: profileData.created_at || profileData.createdAt || s.createdAt || s.created_at || new Date().toISOString(),
            created_at: profileData.created_at || profileData.createdAt || s.createdAt || s.created_at || new Date().toISOString()
        });
        store.login(updated);
        if (updated.createdAt) {
            localStorage.setItem(nxUserKey('nx_created_at'), String(updated.createdAt));
        }
        localStorage.setItem(nxUserKey('nx_total_earnings'), String(liveBal));
        if (updated.isAdmin) localStorage.setItem('nx_is_admin', '1');
        if (updated.accountActive) {
            localStorage.setItem(nxUserKey('nx_account_active'), 'true');
            localStorage.setItem('nx_active', 'true');
        } else {
            localStorage.setItem(nxUserKey('nx_account_active'), 'false');
            localStorage.setItem('nx_active', 'false');
        }
        personalise(updated);
        renderBalances();
        if (window.TaskVestTasks) {
            if (typeof window.TaskVestTasks.syncBalanceFromSupabase === 'function') window.TaskVestTasks.syncBalanceFromSupabase(liveBal);
            if (typeof window.TaskVestTasks.refresh === 'function') window.TaskVestTasks.refresh();
        }
    }

    function syncCurrentUserProfile() {
        return; // local-only build: no server sync
        var s = store.session();
        if (!s || (!s.id && !s.email && !s.username)) return;
        var query = s.id ? ('id=' + encodeURIComponent(s.id)) : (s.email ? ('email=' + encodeURIComponent(s.email)) : ('username=' + encodeURIComponent(s.username)));
        fetch('/api/auth/me?' + query)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.success && data.user) {
                    var u = data.user;
                    var liveBal = u.balance != null ? Number(u.balance) : (s.balance != null ? Number(s.balance) : 0);
                    var liveLife = u.lifetimeEarnings != null ? Number(u.lifetimeEarnings) : (s.lifetimeEarnings || liveBal);
                    var updatedSession = Object.assign({}, s, {
                        id: u.id || s.id,
                        email: u.email || s.email,
                        fullName: u.fullName || s.fullName,
                        username: u.username || s.username,
                        isAdmin: !!u.isAdmin,
                        is_admin: !!u.isAdmin,
                        accountActive: !!u.accountActive,
                        esimPlan: u.esimPlan || s.esimPlan,
                        esimNumber: u.esimNumber || s.esimNumber,
                        balance: liveBal,
                        lifetimeEarnings: liveLife,
                        lifetime_earnings: liveLife,
                        bankName: u.bankName || s.bankName,
                        bankAccountNumber: u.bankAccountNumber || s.bankAccountNumber,
                        bankAccountName: u.bankAccountName || s.bankAccountName,
                        createdAt: u.createdAt || u.created_at || s.createdAt || s.created_at || new Date().toISOString(),
                        created_at: u.createdAt || u.created_at || s.createdAt || s.created_at || new Date().toISOString()
                    });
                    store.login(updatedSession);
                    if (updatedSession.createdAt) {
                        localStorage.setItem(nxUserKey('nx_created_at'), String(updatedSession.createdAt));
                    }
                    if (u.isAdmin || u.is_admin || u.email === 'benjaminemenike6@gmail.com' || u.email === 'bigbenrave@gmail.com' || s.email === 'benjaminemenike6@gmail.com' || s.email === 'bigbenrave@gmail.com') {
                        localStorage.setItem('nx_is_admin', '1');
                        updatedSession.isAdmin = true;
                    } else {
                        localStorage.setItem('nx_is_admin', '0');
                    }
                    if (u.accountActive) {
                        localStorage.setItem(nxUserKey('nx_account_active'), 'true');
                        localStorage.setItem('nx_active', 'true');
                    } else {
                        localStorage.setItem(nxUserKey('nx_account_active'), 'false');
                        localStorage.setItem('nx_active', 'false');
                    }
                    if (u.esimPlan) {
                        localStorage.setItem(nxUserKey('nx_esim_plan'), u.esimPlan);
                    }
                    if (u.esimNumber) {
                        localStorage.setItem('nx_esim_number', u.esimNumber);
                    }
                    localStorage.setItem(nxUserKey('nx_total_earnings'), String(liveBal));

                    // If Supabase returned transactions, update the store deduplicated
                    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
                        var seen = {};
                        var cleanTxs = [];
                        data.transactions.forEach(function (tx) {
                            if (!tx) return;
                            var key = tx.id || ((tx.type || '') + '|' + (tx.label || '') + '|' + (tx.amount || '') + '|' + (tx.created_at || '').substring(0, 16));
                            if (!seen[key]) {
                                seen[key] = true;
                                cleanTxs.push(tx);
                            }
                        });
                        set(K.TX, cleanTxs);
                    }

                    personalise(updatedSession);
                    renderBalances();
                    renderTransactions();

                    // Sync tasks and balances with TaskVestTasks
                    if (window.TaskVestTasks) {
                        if (typeof window.TaskVestTasks.syncTasksFromSupabase === 'function' && Array.isArray(data.tasks)) {
                            window.TaskVestTasks.syncTasksFromSupabase(data.tasks);
                        }
                        if (typeof window.TaskVestTasks.syncBalanceFromSupabase === 'function') {
                            window.TaskVestTasks.syncBalanceFromSupabase(liveBal);
                        }
                        if (typeof window.TaskVestTasks.injectAdminControls === 'function') {
                            window.TaskVestTasks.injectAdminControls();
                        }
                        if (typeof window.TaskVestTasks.refresh === 'function') {
                            window.TaskVestTasks.refresh();
                        }
                    }
                }
            })
            .catch(function () {});
    }

    earlyBoot();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ====================================================================
     * 12. PUBLIC API (console)
     * ==================================================================== */
})();
