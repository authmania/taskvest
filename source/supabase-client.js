/**
 * Nextel Connect - Supabase Auth & Database Client Integration
 * -------------------------------------------------------------
 * Direct Supabase Authentication & Database Integration.
 * Connects directly to Supabase Auth and Database via server-side endpoints & client SDK.
 */

(function(window) {
    'use strict';

    // Default System Guard / Bank Configuration
    var DEFAULT_GUARD = {
        bankName: 'Kuda Mfb',
        accountNumber: '3003679860',
        accountName: 'RUBAN ENTERPRISE',
        telegramLink: 'https://t.me/m/W64grp0qYjU0',
        diamondPrice: 10500,
        royalPrice: 17500,
        withdrawThreshold: 15000,
        maxEarnings: 50000,
        currency: 'NGN',
        usdRate: 1000,
        diamondPackage: true,
        royalPackage: true,
        usePaymentLink: false,
        usePaystackGatewayApi: false,
        paymentLink1: '',
        paymentLink2: '',
        activationGuideVideoUrl: 'https://files.catbox.moe/zuy9vr.mp4',
        dailyEarnCapEnabled: false,
        dailyEarnCapAmount: 15000,
        callEarnAmount: 2100,
        showQuickTask: true,
        reachMinBeforeWithdraw: false,
        welcomeBalance: 10000,
        paystackSecretKey: '',
        showPaymentCautionText: true,
        paymentCautionText: 'Notice: Payment using Opay is not allowed for activation use commercial banks',
        showActivationCountdown: true,
        activationCountdownDays: 4,
        displayJoinTgChannel: true,
        tgChannelUrl: 'https://t.me/nextelconnect',
        useEsimCodeWithrawalFlow: false,
        esimCodeForWithd: '+1 (202) 555-0194'
    };

    function cleanUrl(u) {
        if (!u) return '';
        var s = String(u).trim().replace(/^["']|["']$/g, '').trim();
        if (!s) return '';
        if (!/^https?:\/\//i.test(s)) {
            s = 'https://' + s;
        }
        return s.replace(/\/+$/, '');
    }

    function cleanKey(k) {
        if (!k) return '';
        return String(k).trim().replace(/^["']|["']$/g, '').trim();
    }

    var SUPABASE_URL = cleanUrl(
        (typeof window !== 'undefined' && (window.ENV_SUPABASE_URL || (window.__ENV__ && (window.__ENV__.VITE_SUPABASE_URL || window.__ENV__.SUPABASE_URL)))) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('nx_supabase_url')) ||
        ''
    );
    var SUPABASE_ANON_KEY = cleanKey(
        (typeof window !== 'undefined' && (window.ENV_SUPABASE_ANON_KEY || (window.__ENV__ && (window.__ENV__.VITE_SUPABASE_ANON_KEY || window.__ENV__.SUPABASE_ANON_KEY)))) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('nx_supabase_anon_key')) ||
        ''
    );

    var activeClientUrl = (typeof window !== 'undefined' && window.__NEXTEL_SUPABASE_URL__) || null;
    var activeClientKey = (typeof window !== 'undefined' && window.__NEXTEL_SUPABASE_KEY__) || null;
    var client = (typeof window !== 'undefined' && window.__NEXTEL_SUPABASE_CLIENT__) || null;
    var authListeners = (typeof window !== 'undefined' && window.__NEXTEL_AUTH_LISTENERS__) || [];
    if (typeof window !== 'undefined') {
        window.__NEXTEL_AUTH_LISTENERS__ = authListeners;
    }
    var authStateSubscription = null;
    var activeRealtimeChannel = null;

    function setupRealtimeForUser(userId) {
        if (!client || !userId) return;
        if (activeRealtimeChannel) {
            try { client.removeChannel(activeRealtimeChannel); } catch (_) {}
            activeRealtimeChannel = null;
        }
        try {
            activeRealtimeChannel = client.channel('rt_user_' + userId);
            activeRealtimeChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId }, function(payload) {
                    if (payload.new && window.NexAuth && typeof window.NexAuth.syncProfileNow === 'function') {
                        window.NexAuth.syncProfileNow(payload.new);
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'user_tasks', filter: 'user_id=eq.' + userId }, function() {
                    if (window.NexAuth && typeof window.NexAuth.syncCurrentUserProfile === 'function') {
                        window.NexAuth.syncCurrentUserProfile();
                    }
                })
                .subscribe();
        } catch (e) {
            console.warn('[Nextel Supabase] Realtime subscription error:', e);
        }
    }

    function initClient() {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return client;
        if (!window.supabase || typeof window.supabase.createClient !== 'function') return client;

        // Strict Singleton check: if already initialized with identical URL and Anon key, reuse existing instance!
        if (client && activeClientUrl === SUPABASE_URL && activeClientKey === SUPABASE_ANON_KEY) {
            return client;
        }

        try {
            if (activeRealtimeChannel && client) {
                try { client.removeChannel(activeRealtimeChannel); } catch (_) {}
                activeRealtimeChannel = null;
            }
            if (authStateSubscription && typeof authStateSubscription.unsubscribe === 'function') {
                try { authStateSubscription.unsubscribe(); } catch (_) {}
                authStateSubscription = null;
            }

            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            });

            activeClientUrl = SUPABASE_URL;
            activeClientKey = SUPABASE_ANON_KEY;
            if (typeof window !== 'undefined') {
                window.__NEXTEL_SUPABASE_CLIENT__ = client;
                window.__NEXTEL_SUPABASE_URL__ = SUPABASE_URL;
                window.__NEXTEL_SUPABASE_KEY__ = SUPABASE_ANON_KEY;
                window.NextelClient = client;
            }

            var diag = NextelSupabase ? NextelSupabase.getDiagnostic() : { urlHost: SUPABASE_URL, anonKeyConfigured: !!SUPABASE_ANON_KEY };
            console.log('[Nextel Supabase] Client initialized for host:', diag.urlHost, '| anonKeyConfigured:', diag.anonKeyConfigured);

            // Auto-subscribe to real-time updates for logged in user
            try {
                var rawS = localStorage.getItem('nx_session');
                if (rawS) {
                    var s = JSON.parse(rawS);
                    if (s && s.id) setupRealtimeForUser(s.id);
                }
            } catch (_) {}

            var authRes = client.auth.onAuthStateChange(function(event, session) {
                authListeners.forEach(function(fn) {
                    try { fn(event, session); } catch (e) { console.error(e); }
                });
                if (session && session.user && session.user.id) {
                    setupRealtimeForUser(session.user.id);
                }
            });
            if (authRes && authRes.data && authRes.data.subscription) {
                authStateSubscription = authRes.data.subscription;
            }
        } catch (e) {
            console.warn('[Nextel Supabase] Client init warning:', e);
        }
        return client;
    }

    // Dynamic config fetch with promise reuse and localStorage caching
    var configFetchPromise = null;
    function fetchConfig() {
        if (configFetchPromise) return configFetchPromise;
        configFetchPromise = fetch('/api/config')
            .then(function(r) {
                if (!r.ok) throw new Error('Config endpoint HTTP ' + r.status);
                return r.json();
            })
            .then(function(data) {
                if (data) {
                    var urlChanged = false;
                    var keyChanged = false;
                    if (data.supabaseUrl) {
                        var cleanedUrl = cleanUrl(data.supabaseUrl);
                        if (cleanedUrl && cleanedUrl !== SUPABASE_URL) {
                            SUPABASE_URL = cleanedUrl;
                            urlChanged = true;
                        }
                        window.ENV_SUPABASE_URL = SUPABASE_URL;
                        try { localStorage.setItem('nx_supabase_url', SUPABASE_URL); } catch (_) {}
                    }
                    if (data.supabaseAnonKey) {
                        var cleanedKey = cleanKey(data.supabaseAnonKey);
                        if (cleanedKey && cleanedKey !== SUPABASE_ANON_KEY) {
                            SUPABASE_ANON_KEY = cleanedKey;
                            keyChanged = true;
                        }
                        window.ENV_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
                        try { localStorage.setItem('nx_supabase_anon_key', SUPABASE_ANON_KEY); } catch (_) {}
                    }
                    if (data.defaultGuard) {
                        Object.assign(DEFAULT_GUARD, data.defaultGuard);
                    }
                    if (data.showActivationCountdown !== undefined) {
                        DEFAULT_GUARD.showActivationCountdown = !!data.showActivationCountdown;
                        try { localStorage.setItem('nx_show_activation_countdown', String(data.showActivationCountdown)); } catch (_) {}
                    }
                    if (data.activationCountdownDays !== undefined) {
                        DEFAULT_GUARD.activationCountdownDays = Number(data.activationCountdownDays) || 4;
                        try { localStorage.setItem('nx_activation_countdown_days', String(data.activationCountdownDays)); } catch (_) {}
                    }
                    if (data.displayJoinTgChannel !== undefined) {
                        DEFAULT_GUARD.displayJoinTgChannel = !!data.displayJoinTgChannel;
                        try { localStorage.setItem('nx_display_join_tg_channel', String(data.displayJoinTgChannel)); } catch (_) {}
                    }
                    if (data.tgChannelUrl !== undefined) {
                        DEFAULT_GUARD.tgChannelUrl = String(data.tgChannelUrl || '').trim();
                        try { localStorage.setItem('nx_tg_channel_url', DEFAULT_GUARD.tgChannelUrl); } catch (_) {}
                    }
                    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
                        if (!client || urlChanged || keyChanged) {
                            initClient();
                        }
                    }
                }
                return data;
            })
            .catch(function(err) {
                console.warn('[Nextel Supabase] Config fetch note:', err.message);
                return null;
            });
        return configFetchPromise;
    }

    // Trigger config fetch on load
    try { fetchConfig(); } catch (_) {}

    // Load Supabase JS CDN script if not loaded
    if (!window.supabase) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.async = true;
        script.onload = function() {
            initClient();
        };
        document.head.appendChild(script);
    } else {
        initClient();
    }

    var NextelSupabase = {
        defaultGuard: DEFAULT_GUARD,

        // Safe Diagnostic: Reports variable existence & URL validity without EVER exposing anon key
        getDiagnostic: function() {
            var hasUrl = !!SUPABASE_URL;
            var hasKey = !!SUPABASE_ANON_KEY;
            var isValidUrl = false;
            var host = '';
            try {
                if (hasUrl) {
                    var parsed = new URL(SUPABASE_URL);
                    isValidUrl = (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.length > 0;
                    host = parsed.hostname;
                }
            } catch (_) {}
            return {
                urlConfigured: hasUrl,
                urlValid: isValidUrl,
                urlHost: host || null,
                anonKeyConfigured: hasKey,
                isClientInitialized: !!client,
                configured: !!(hasUrl && hasKey && isValidUrl)
            };
        },

        getClient: function() {
            if (!client && window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
                initClient();
            }
            return client;
        },

        onAuthChange: function(callback) {
            if (typeof callback === 'function') {
                authListeners.push(callback);
            }
        },

        // Sign Up with Supabase Auth + Create Profile
        signUp: async function(userData) {
            var email = (userData.email || '').trim().toLowerCase();
            var password = userData.password;
            var fullName = userData.fullName || userData.name || '';
            var username = (userData.username || email.split('@')[0]).trim().toLowerCase();
            var phone = userData.phone || '';
            var country = userData.country || 'Nigeria';

            if (!email || !password) {
                return { success: false, error: 'Email and password are required.' };
            }

            // 1. First attempt: Server-Side Registration API
            // This guarantees zero CORS errors and bypasses any client-side network restrictions.
            try {
                var response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        fullName: fullName,
                        username: username,
                        phone: phone,
                        country: country
                    })
                });

                var resData = await response.json();
                if (response.ok && resData && resData.success) {
                    // Try to sign in client-side too if SDK is available
                    var c = this.getClient();
                    if (c) {
                        try {
                            await c.auth.signInWithPassword({ email: email, password: password });
                        } catch (_) {}
                    }
                    return resData;
                } else if (resData && resData.error) {
                    return { success: false, error: resData.error };
                }
            } catch (apiErr) {
                console.warn('[Nextel Supabase] API register error:', apiErr);
            }

            // 2. Direct Supabase Client fallback
            var cClient = this.getClient();
            if (cClient) {
                try {
                    var authRes = await cClient.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                full_name: fullName,
                                username: username,
                                phone: phone,
                                country: country
                            }
                        }
                    });

                    if (authRes.error) {
                        return { success: false, error: authRes.error.message };
                    }

                    var user = authRes.data && authRes.data.user;
                    var userId = user ? user.id : 'nx-user-' + Date.now();

                    // Fetch welcome_balance from system_settings as single source of truth for new registration
                    var welcomeBalance = 10000;
                    try {
                        var sysRes = await cClient.from('system_settings').select('welcome_balance').eq('id', 'default_settings').maybeSingle();
                        if (sysRes && sysRes.data && sysRes.data.welcome_balance != null) {
                            var pBal = Number(sysRes.data.welcome_balance);
                            if (!isNaN(pBal)) welcomeBalance = pBal;
                        }
                    } catch (_) {}

                    var createdProfile = null;
                    try {
                        await cClient.from('profiles').delete().eq('id', userId);
                    } catch (_) {}

                    var profilePayload = {
                        id: userId,
                        email: email,
                        full_name: fullName,
                        username: username,
                        phone: phone,
                        country: country,
                        account_active: false,
                        balance: welcomeBalance,
                        lifetime_earnings: welcomeBalance,
                        updated_at: new Date().toISOString()
                    };

                    try {
                        var insRes = await cClient.from('profiles').insert(profilePayload).select('*').single();
                        if (insRes && insRes.data) {
                            createdProfile = insRes.data;
                        }
                    } catch (insErr) {
                        console.warn('[Supabase Profile Insert]', insErr);
                    }

                    if (!createdProfile) {
                        try {
                            var upRes = await cClient.from('profiles').upsert(profilePayload, { onConflict: 'id' }).select('*').single();
                            if (upRes && upRes.data) {
                                createdProfile = upRes.data;
                            }
                        } catch (dbErr) {
                            console.warn('[Supabase Profile Upsert]', dbErr);
                        }
                    }

                    // Guarantee database user profile row has the welcome balance
                    try {
                        await cClient.from('profiles').update({
                            balance: welcomeBalance,
                            lifetime_earnings: welcomeBalance,
                            updated_at: new Date().toISOString()
                        }).eq('id', userId);
                    } catch (_) {}

                    if (!createdProfile) {
                        try {
                            var pGet = await cClient.from('profiles').select('*').eq('id', userId).single();
                            if (pGet && pGet.data) createdProfile = pGet.data;
                        } catch (_) {}
                    }

                    var userBal = createdProfile && createdProfile.balance != null ? Number(createdProfile.balance) : welcomeBalance;
                    var userLife = createdProfile && createdProfile.lifetime_earnings != null ? Number(createdProfile.lifetime_earnings) : userBal;

                    return {
                        success: true,
                        user: {
                            id: userId,
                            email: email,
                            fullName: fullName,
                            username: username,
                            phone: phone,
                            country: country,
                            balance: userBal,
                            lifetimeEarnings: userLife,
                            accountActive: createdProfile ? !!createdProfile.account_active : false,
                            createdAt: createdProfile ? (createdProfile.created_at || new Date().toISOString()) : new Date().toISOString(),
                            created_at: createdProfile ? (createdProfile.created_at || new Date().toISOString()) : new Date().toISOString()
                        }
                    };
                } catch (err) {
                    return { success: false, error: err.message || 'Registration failed. Please check your connection and Supabase credentials.' };
                }
            }

            // 3. Clear distinction:
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                return {
                    success: false,
                    code: 'CONFIG_MISSING',
                    error: 'Supabase authentication service is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in Settings.'
                };
            }

            if (serverErrorMsg) {
                return { success: false, error: serverErrorMsg };
            }

            return {
                success: false,
                code: 'CONNECTION_ERROR',
                error: 'Unable to connect to registration service. Please check your network connection.'
            };
        },

        // Sign In with Supabase Auth
        signIn: async function(loginIdentifier, password) {
            var id = (loginIdentifier || '').trim();
            if (!id || !password) {
                return { success: false, error: 'Please provide your email/username and password.' };
            }

            // Ensure configuration is fetched if client not ready
            if (!client || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
                try { await fetchConfig(); } catch (_) {}
            }

            // 1. First attempt: Server-Side Login API
            var serverAttempted = false;
            var serverErrorMsg = null;
            var serverCode = null;
            var serverStatus = 0;

            try {
                var response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identifier: id,
                        password: password
                    })
                });

                serverAttempted = true;
                serverStatus = response.status;
                var resData = await response.json().catch(function() { return null; });

                if (response.ok && resData && resData.success) {
                    var c = this.getClient();
                    if (c && resData.session) {
                        try {
                            await c.auth.setSession(resData.session);
                        } catch (_) {}
                    }
                    return resData;
                }

                if (resData && resData.error) {
                    serverErrorMsg = resData.error;
                    serverCode = resData.code;

                    // If server explicitly confirmed invalid credentials (HTTP 401 / INVALID_CREDENTIALS),
                    // return immediately so we never report configuration errors or vague messages.
                    if (serverStatus === 401 || serverCode === 'INVALID_CREDENTIALS' || /invalid login credentials|invalid username or password/i.test(resData.error)) {
                        return {
                            success: false,
                            code: 'INVALID_CREDENTIALS',
                            error: 'Invalid login credentials. Please check your username/email and password.'
                        };
                    }

                    // If server returned CONFIG_MISSING or NETWORK_ERROR, return immediately with clear message
                    if (serverCode === 'CONFIG_MISSING' || serverCode === 'NETWORK_ERROR') {
                        return {
                            success: false,
                            code: serverCode,
                            error: serverErrorMsg
                        };
                    }
                }
            } catch (apiErr) {
                console.warn('[Nextel Supabase] API login error:', apiErr);
            }

            // 2. Direct Client fallback (if client SDK is configured)
            var cClient = this.getClient();
            if (cClient) {
                try {
                    var isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id);
                    var emailToUse = isEmail ? id.toLowerCase() : null;

                    if (!isEmail) {
                        try {
                            var uRes = await cClient.from('profiles').select('email').ilike('username', id).single();
                            if (uRes.data && uRes.data.email) {
                                emailToUse = uRes.data.email;
                            }
                        } catch (_) {}
                    }

                    if (!emailToUse) emailToUse = id;

                    var authRes = await cClient.auth.signInWithPassword({
                        email: emailToUse,
                        password: password
                    });

                    if (authRes.error) {
                        var msg = authRes.error.message || '';
                        if (/invalid login credentials/i.test(msg) || /invalid_grant/i.test(msg)) {
                            return {
                                success: false,
                                code: 'INVALID_CREDENTIALS',
                                error: 'Invalid login credentials. Please check your username/email and password.'
                            };
                        }
                        if (/email not confirmed/i.test(msg)) {
                            return {
                                success: false,
                                code: 'EMAIL_NOT_CONFIRMED',
                                error: 'Your email has not been confirmed. Please check your inbox or contact support.'
                            };
                        }
                        return { success: false, error: msg };
                    }

                    if (authRes.data && authRes.data.user) {
                        var user = authRes.data.user;
                        var meta = user.user_metadata || {};
                        var profile = null;
                        var bank = null;

                        try {
                            var pRes = await cClient.from('profiles').select('*').eq('id', user.id).single();
                            if (pRes.data) profile = pRes.data;
                        } catch (_) {}

                        try {
                            var bRes = await cClient.from('user_banks').select('*').eq('user_id', user.id).single();
                            if (bRes.data) bank = bRes.data;
                        } catch (_) {}

                        return {
                            success: true,
                            user: {
                                id: user.id,
                                email: user.email,
                                fullName: (profile && profile.full_name) || meta.full_name || 'Nextel User',
                                username: (profile && profile.username) || meta.username || user.email.split('@')[0],
                                phone: (profile && profile.phone) || meta.phone || '',
                                country: (profile && profile.country) || meta.country || 'Nigeria',
                                accountActive: profile ? !!profile.account_active : false,
                                esimPlan: profile ? profile.esim_plan : null,
                                esimNumber: profile ? profile.esim_number : null,
                                balance: profile ? Number(profile.balance) : 0,
                                lifetimeEarnings: profile ? Number(profile.lifetime_earnings != null ? profile.lifetime_earnings : profile.balance) : 0,
                                isAdmin: profile ? !!profile.is_admin : false,
                                bankName: bank ? bank.bank_name : (profile ? profile.bank_name : null),
                                bankAccountNumber: bank ? bank.account_number : (profile ? profile.bank_account_number : null),
                                bankAccountName: bank ? bank.account_name : (profile ? profile.bank_account_name : null),
                                bankCode: bank ? bank.bank_code : '000',
                                createdAt: (profile && profile.created_at) || user.created_at || new Date().toISOString(),
                                created_at: (profile && profile.created_at) || user.created_at || new Date().toISOString()
                            }
                        };
                    }
                } catch (err) {
                    return { success: false, error: err.message || 'Authentication error.' };
                }
            }

            // 3. Clear, accurate error classification (never conflate missing configuration with bad credentials)
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                return {
                    success: false,
                    code: 'CONFIG_MISSING',
                    error: 'Supabase authentication service is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in Settings.'
                };
            }

            if (serverErrorMsg) {
                return { success: false, code: serverCode, error: serverErrorMsg };
            }

            return {
                success: false,
                code: 'CONNECTION_ERROR',
                error: 'Unable to connect to Supabase authentication service. Please check your network connection and try again.'
            };
        },

        // Sign Out
        signOut: async function() {
            var c = this.getClient();
            if (c) {
                try {
                    await c.auth.signOut();
                } catch (e) {
                    console.warn('[Supabase SignOut]', e);
                }
            }
        },

        // Get Current Active User
        getCurrentUser: async function() {
            var c = this.getClient();
            if (!c) return null;
            try {
                var sRes = await c.auth.getSession();
                if (sRes.data && sRes.data.session) {
                    var u = sRes.data.session.user;
                    var pRes = await c.from('profiles').select('*').eq('id', u.id).single();
                    var bRes = await c.from('user_banks').select('*').eq('user_id', u.id).single();
                    return {
                        id: u.id,
                        email: u.email,
                        fullName: (pRes.data && pRes.data.full_name) || u.user_metadata.full_name || 'Nextel User',
                        username: (pRes.data && pRes.data.username) || u.user_metadata.username || u.email.split('@')[0],
                        phone: (pRes.data && pRes.data.phone) || u.user_metadata.phone || '',
                        country: (pRes.data && pRes.data.country) || u.user_metadata.country || 'Nigeria',
                        accountActive: pRes.data ? !!pRes.data.account_active : false,
                        esimPlan: pRes.data ? pRes.data.esim_plan : null,
                        esimNumber: pRes.data ? pRes.data.esim_number : null,
                        balance: pRes.data ? Number(pRes.data.balance) : 10000,
                        isAdmin: pRes.data ? !!pRes.data.is_admin : false,
                        bankName: bRes.data ? bRes.data.bank_name : null,
                        bankAccountNumber: bRes.data ? bRes.data.account_number : null,
                        bankAccountName: bRes.data ? bRes.data.account_name : null,
                        createdAt: (pRes.data && pRes.data.created_at) || u.created_at || new Date().toISOString(),
                        created_at: (pRes.data && pRes.data.created_at) || u.created_at || new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('[Supabase getCurrentUser]', e);
            }
            return null;
        },

        // Sync Profile Data
        syncProfile: async function(userId, profileData) {
            var c = this.getClient();
            if (!c || !userId) return;
            try {
                await c.from('profiles').update(Object.assign({
                    updated_at: new Date().toISOString()
                }, profileData)).eq('id', userId);
            } catch (e) {
                console.warn('[Supabase Sync Profile]', e);
            }
        },

        // Save User Linked Bank Details
        saveBankDetails: async function(userId, bankData) {
            var c = this.getClient();
            if (c && userId) {
                try {
                    await c.from('user_banks').upsert({
                        user_id: userId,
                        bank_name: bankData.bankName,
                        bank_code: bankData.bankCode || '000',
                        account_number: bankData.accountNumber,
                        account_name: bankData.accountName,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                } catch (e) {
                    console.warn('[Supabase Save Bank]', e);
                }
            }
            try {
                await fetch('/api/user/save-bank', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        email: bankData.email,
                        bankName: bankData.bankName,
                        bankCode: bankData.bankCode || '000',
                        accountNumber: bankData.accountNumber,
                        accountName: bankData.accountName
                    })
                });
            } catch (_) {}
        },

        // Verify Nigerian Bank Account via Supabase Edge Function
        verifyBankAccount: async function(accountNumber, bankCode) {
            var cleanAcc = String(accountNumber || '').trim();
            var cleanCode = String(bankCode || '').trim();
            if (!cleanAcc || cleanAcc.length !== 10 || !cleanCode) {
                return { success: false, verified: false, error: 'Enter a valid 10-digit account number and select a bank.' };
            }

            var c = this.getClient();
            if (c && c.functions && typeof c.functions.invoke === 'function') {
                try {
                    var invokeRes = await c.functions.invoke('verify-bank-account', {
                        body: { account_number: cleanAcc, bank_code: cleanCode }
                    });
                    if (invokeRes.data && (invokeRes.data.success !== undefined || invokeRes.data.account_name)) {
                        return invokeRes.data;
                    }
                } catch (err) {
                    console.warn('[Supabase invoke verify-bank-account]', err);
                }
            }

            // Direct Supabase Edge Function endpoint fetch
            if (SUPABASE_URL) {
                try {
                    var edgeUrl = SUPABASE_URL + '/functions/v1/verify-bank-account';
                    var headers = { 'Content-Type': 'application/json' };
                    if (SUPABASE_ANON_KEY) {
                        headers['apikey'] = SUPABASE_ANON_KEY;
                        headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
                    }
                    var edgeRes = await fetch(edgeUrl, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ account_number: cleanAcc, bank_code: cleanCode })
                    });
                    if (edgeRes.ok) {
                        var data = await edgeRes.json();
                        return data;
                    }
                } catch (edgeErr) {
                    console.warn('[Direct Edge Function verify-bank-account]', edgeErr);
                }
            }

            // Backend proxy fallback
            try {
                var serverRes = await fetch('/api/verify-bank-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_number: cleanAcc, bank_code: cleanCode })
                });
                if (serverRes.ok) {
                    var sData = await serverRes.json();
                    return sData;
                }
            } catch (sErr) {
                console.warn('[Server proxy verify-bank-account]', sErr);
            }

            return { success: false, verified: false, error: 'Verification failed. Please try again.' };
        },

        // Log Transaction (Deprecated to optimize Supabase egress - tasks stored in user_tasks)
        syncTransaction: async function(userId, tx) {
            return;
        },

        // Get User Tasks
        getUserTasks: async function(userId) {
            var c = this.getClient();
            if (!c || !userId) return [];
            try {
                var res = await c.from('user_tasks')
                    .select('id, task_type, task_id, task_name, reward_amount, completed_date, completed_at')
                    .eq('user_id', userId)
                    .order('completed_at', { ascending: false })
                    .limit(50);
                return res.data || [];
            } catch (e) {
                console.warn('[Supabase getUserTasks]', e);
                return [];
            }
        },

        // Record User Task Completion
        recordTask: async function(userId, task) {
            if (!userId || !task) return;

            // Map and normalize to exact check constraint allowed values:
            // 'daily_call', 'sponsored_call', 'video_ad', 'banner_ad', 'bonus', 'survey'
            var rawType = String(task.type || task.task_type || '').toLowerCase().trim();
            var taskType = 'sponsored_call';
            if (rawType.includes('daily')) taskType = 'daily_call';
            else if (rawType.includes('call') || rawType.includes('sponsor')) taskType = 'sponsored_call';
            else if (rawType.includes('video')) taskType = 'video_ad';
            else if (rawType.includes('banner')) taskType = 'banner_ad';
            else if (rawType.includes('survey')) taskType = 'survey';
            else taskType = 'bonus';

            var rewardAmt = Number(task.reward != null ? task.reward : task.reward_amount) || 0;
            var taskId = String(task.id || task.taskId || task.task_id || ('task_' + Date.now()));
            var taskName = String(task.name || task.taskName || task.task_name || (taskType === 'sponsored_call' ? 'Sponsored Call' : 'Task Reward'));
            var todayStr = new Date().toISOString().split('T')[0];
            var completedAtStr = new Date().toISOString();

            var c = this.getClient();
            if (c) {
                try {
                    // Direct insert matching exact public.user_tasks schema columns
                    var insertPayload = {
                        user_id: userId,
                        task_type: taskType,
                        task_id: taskId,
                        task_name: taskName,
                        reward_amount: rewardAmt,
                        completed_date: todayStr,
                        completed_at: completedAtStr
                    };

                    var res = await c.from('user_tasks').insert([insertPayload]);
                    if (res && res.error) {
                        console.warn('[Supabase Record Task Direct Insert Error]', res.error);
                    } else {
                        console.log('[Supabase Record Task Insert Success]', insertPayload);
                    }
                } catch (e) {
                    console.warn('[Supabase Record Task]', e);
                }
            }

            // Also call the backend endpoint as a reliable fallback/companion with server service-role privileges
            try {
                var rawS = localStorage.getItem('nx_session');
                var sEmail = '';
                if (rawS) {
                    try { sEmail = JSON.parse(rawS).email || ''; } catch (_) {}
                }
                fetch('/api/user/complete-task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        email: sEmail,
                        taskType: taskType,
                        taskId: taskId,
                        taskName: taskName,
                        reward: rewardAmt
                    })
                }).then(function (r) {
                    return r.json();
                }).then(function (res) {
                    if (res && res.dailyCapReached && window.NextelTasks && typeof window.NextelTasks.showDailyCapModal === 'function') {
                        window.NextelTasks.showDailyCapModal(res.todayEarned, res.capAmount);
                    }
                }).catch(function () {});
            } catch (_) {}
        },

        // Get total amount earned today from user_tasks
        getDailyEarned: async function(userId, dateStr) {
            if (!userId) return 0;
            var targetDate = dateStr || new Date().toISOString().split('T')[0];
            var c = this.getClient();
            if (c) {
                try {
                    var res = await c
                        .from('user_tasks')
                        .select('reward_amount, completed_date, completed_at')
                        .eq('user_id', userId);
                    if (res && Array.isArray(res.data)) {
                        var sum = 0;
                        res.data.forEach(function(row) {
                            var rDate = row.completed_date || (row.completed_at ? String(row.completed_at).slice(0, 10) : '');
                            if (rDate === targetDate) {
                                sum += (Number(row.reward_amount) || 0);
                            }
                        });
                        return sum;
                    }
                } catch (e) {
                    console.warn('[Supabase getDailyEarned]', e);
                }
            }
            try {
                var resp = await fetch('/api/user/daily-cap-status?userId=' + encodeURIComponent(userId) + '&date=' + encodeURIComponent(targetDate));
                if (resp.ok) {
                    var d = await resp.json();
                    if (d && d.todayEarned != null) return Number(d.todayEarned) || 0;
                }
            } catch (_) {}
            return 0;
        },

        // Submit Payment Proof
        submitPaymentProof: async function(userId, proof) {
            var c = this.getClient();
            if (!c) return { success: false, error: 'Database unavailable' };
            try {
                var res = await c.from('payment_proofs').insert([{
                    user_id: userId || null,
                    sender_name: proof.senderName,
                    bank_used: proof.bankUsed,
                    amount: proof.amount || 17500,
                    plan: proof.plan || 'elite',
                    reference: proof.reference || '',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                return { success: !res.error, error: res.error ? res.error.message : null };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        // Activate eSIM Plan
        activateEsim: async function(userId, planKey, esimNumber, code) {
            var c = this.getClient();
            if (!c || !userId) return;
            var normalizedPlan = (function(p) {
                if (!p) return 'elite';
                var s = String(p).toLowerCase();
                return (s.indexOf('diam') !== -1 || s.indexOf('prem') !== -1) ? 'premium' : 'elite';
            })(planKey);
            try {
                var rpcRes = await c.rpc('activate_user_esim', {
                    p_code: code || 'NXT-ACTIVATED',
                    p_plan: normalizedPlan,
                    p_esim_number: esimNumber
                });

                if (rpcRes.error) {
                    await c.from('profiles').update({
                        account_active: true,
                        esim_plan: normalizedPlan,
                        esim_number: esimNumber,
                        activated_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }).eq('id', userId);
                }
            } catch (e) {
                console.warn('[Supabase Activate eSIM]', e);
            }
        },

        // Fetch System Settings
        getSystemSettings: async function() {
            try {
                var res = await fetch('/api/system-settings');
                if (res.ok) {
                    var data = await res.json();
                    if (data) return data;
                }
            } catch (_) {}

            var c = this.getClient();
            if (c) {
                try {
                    var sRes = await c.from('system_settings').select('*').eq('id', 'default_settings').single();
                    if (sRes.data) {
                        return {
                            bankName: sRes.data.bank_name || DEFAULT_GUARD.bankName,
                            accountNumber: sRes.data.account_number || DEFAULT_GUARD.accountNumber,
                            accountName: sRes.data.account_name || DEFAULT_GUARD.accountName,
                            telegramLink: sRes.data.telegram_link || DEFAULT_GUARD.telegramLink,
                            diamondPrice: Number(sRes.data.diamond_price) || DEFAULT_GUARD.diamondPrice,
                            royalPrice: Number(sRes.data.royal_price) || DEFAULT_GUARD.royalPrice,
                            withdrawThreshold: Number(sRes.data.withdraw_threshold ?? sRes.data.withdrawal_threshold) || DEFAULT_GUARD.withdrawThreshold,
                            maxEarnings: Number(sRes.data.max_earnings) || DEFAULT_GUARD.maxEarnings,
                            currency: sRes.data.currency || DEFAULT_GUARD.currency,
                            usdRate: Number(sRes.data.usd_rate) || DEFAULT_GUARD.usdRate,
                            diamondPackage: sRes.data.diamond_package !== undefined ? !!sRes.data.diamond_package : DEFAULT_GUARD.diamondPackage,
                            royalPackage: sRes.data.royal_package !== undefined ? !!sRes.data.royal_package : DEFAULT_GUARD.royalPackage,
                            usePaymentLink: sRes.data.use_payment_link !== undefined ? !!sRes.data.use_payment_link : DEFAULT_GUARD.usePaymentLink,
                            usePaystackGatewayApi: (function() {
                                if (sRes.data.use_paystack_gateway_api !== undefined) return !!sRes.data.use_paystack_gateway_api;
                                try {
                                    var l = localStorage.getItem('nx_use_paystack_gateway_api');
                                    if (l === '1' || l === 'true') return true;
                                    if (l === '0' || l === 'false') return false;
                                } catch (_) {}
                                return DEFAULT_GUARD.usePaystackGatewayApi;
                            })(),
                            paymentLink1: sRes.data.payment_link_1 !== undefined ? sRes.data.payment_link_1 : DEFAULT_GUARD.paymentLink1,
                            paymentLink2: sRes.data.payment_link_2 !== undefined ? sRes.data.payment_link_2 : DEFAULT_GUARD.paymentLink2,
                            activationGuideVideoUrl: sRes.data.activation_guide_video_url || DEFAULT_GUARD.activationGuideVideoUrl,
                            dailyEarnCapEnabled: sRes.data.daily_earn_cap_enabled !== undefined ? !!sRes.data.daily_earn_cap_enabled : DEFAULT_GUARD.dailyEarnCapEnabled,
                            dailyEarnCapAmount: Number(sRes.data.daily_earn_cap_amount ?? DEFAULT_GUARD.dailyEarnCapAmount),
                            callEarnAmount: Number(sRes.data.call_earn_amount ?? DEFAULT_GUARD.callEarnAmount),
                            showQuickTask: sRes.data.show_quick_task !== undefined ? !!sRes.data.show_quick_task : DEFAULT_GUARD.showQuickTask,
                            reachMinBeforeWithdraw: sRes.data.reach_min_before_withdraw !== undefined ? !!sRes.data.reach_min_before_withdraw : DEFAULT_GUARD.reachMinBeforeWithdraw,
                            welcomeBalance: sRes.data.welcome_balance !== undefined && sRes.data.welcome_balance !== null ? Number(sRes.data.welcome_balance) : DEFAULT_GUARD.welcomeBalance,
                            paystackSecretKey: (function() {
                                if (sRes.data.paystack_secret_key && String(sRes.data.paystack_secret_key).trim().startsWith('sk_')) {
                                    return String(sRes.data.paystack_secret_key).trim();
                                }
                                try {
                                    var lKey = localStorage.getItem('nx_paystack_secret_key');
                                    if (lKey && lKey.startsWith('sk_')) return lKey;
                                } catch (_) {}
                                return DEFAULT_GUARD.paystackSecretKey || '';
                            })(),
                            showPaymentCautionText: sRes.data.show_payment_caution_text !== undefined ? !!sRes.data.show_payment_caution_text : (sRes.data.showPaymentCautionText !== undefined ? !!sRes.data.showPaymentCautionText : DEFAULT_GUARD.showPaymentCautionText),
                            paymentCautionText: sRes.data.payment_caution_text !== undefined ? sRes.data.payment_caution_text : (sRes.data.paymentCautionText !== undefined ? sRes.data.paymentCautionText : DEFAULT_GUARD.paymentCautionText),
                            useEsimCodeWithrawalFlow: sRes.data.use_esim_code_withrawal_flow !== undefined ? !!sRes.data.use_esim_code_withrawal_flow : (sRes.data.use_esim_code_withdrawal_flow !== undefined ? !!sRes.data.use_esim_code_withdrawal_flow : (sRes.data.useEsimCodeWithrawalFlow !== undefined ? !!sRes.data.useEsimCodeWithrawalFlow : DEFAULT_GUARD.useEsimCodeWithrawalFlow)),
                            esimCodeForWithd: sRes.data.esim_code_for_withd !== undefined ? sRes.data.esim_code_for_withd : (sRes.data.esimCodeForWithd !== undefined ? sRes.data.esimCodeForWithd : DEFAULT_GUARD.esimCodeForWithd),
                            show_payment_caution_text: sRes.data.show_payment_caution_text !== undefined ? !!sRes.data.show_payment_caution_text : (sRes.data.showPaymentCautionText !== undefined ? !!sRes.data.showPaymentCautionText : DEFAULT_GUARD.showPaymentCautionText),
                            payment_caution_text: sRes.data.payment_caution_text !== undefined ? sRes.data.payment_caution_text : (sRes.data.paymentCautionText !== undefined ? sRes.data.paymentCautionText : DEFAULT_GUARD.paymentCautionText),
                            use_esim_code_withrawal_flow: sRes.data.use_esim_code_withrawal_flow !== undefined ? !!sRes.data.use_esim_code_withrawal_flow : (sRes.data.use_esim_code_withdrawal_flow !== undefined ? !!sRes.data.use_esim_code_withdrawal_flow : (sRes.data.useEsimCodeWithrawalFlow !== undefined ? !!sRes.data.useEsimCodeWithrawalFlow : DEFAULT_GUARD.useEsimCodeWithrawalFlow)),
                            esim_code_for_withd: sRes.data.esim_code_for_withd !== undefined ? sRes.data.esim_code_for_withd : (sRes.data.esimCodeForWithd !== undefined ? sRes.data.esimCodeForWithd : DEFAULT_GUARD.esimCodeForWithd)
                        };
                    }
                } catch (e) {
                    console.warn('[Nextel getSystemSettings]', e);
                }
            }
            return DEFAULT_GUARD;
        },

        // Update System Settings (Admin)
        updateSystemSettings: async function(newSettings) {
            try {
                var res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newSettings)
                });
                var data = await res.json();
                if (res.ok && data && data.success) {
                    return { success: true, settings: data.settings };
                } else if (data && data.error) {
                    return { success: false, error: data.error };
                }
            } catch (err) {
                console.warn('[Nextel updateSystemSettings API error]', err);
            }

            var c = this.getClient();
            if (c) {
                try {
                    var updateObj = {
                        id: 'default_settings',
                        updated_at: new Date().toISOString()
                    };
                    if (newSettings.bankName !== undefined) updateObj.bank_name = newSettings.bankName;
                    if (newSettings.accountNumber !== undefined) updateObj.account_number = newSettings.accountNumber;
                    if (newSettings.accountName !== undefined) updateObj.account_name = newSettings.accountName;
                    if (newSettings.telegramLink !== undefined) updateObj.telegram_link = newSettings.telegramLink;
                    if (newSettings.diamondPrice !== undefined) updateObj.diamond_price = Number(newSettings.diamondPrice);
                    if (newSettings.royalPrice !== undefined) updateObj.royal_price = Number(newSettings.royalPrice);
                    if (newSettings.withdrawThreshold !== undefined) updateObj.withdraw_threshold = Number(newSettings.withdrawThreshold);
                    if (newSettings.maxEarnings !== undefined) updateObj.max_earnings = Number(newSettings.maxEarnings);
                    if (newSettings.currency !== undefined) updateObj.currency = newSettings.currency;
                    if (newSettings.usdRate !== undefined) updateObj.usd_rate = Number(newSettings.usdRate);
                    if (newSettings.diamondPackage !== undefined) updateObj.diamond_package = !!newSettings.diamondPackage;
                    if (newSettings.royalPackage !== undefined) updateObj.royal_package = !!newSettings.royalPackage;
                    if (newSettings.welcomeBalance !== undefined || newSettings.welcome_balance !== undefined) {
                        updateObj.welcome_balance = Number(newSettings.welcomeBalance ?? newSettings.welcome_balance);
                    }

                    // Mutual exclusivity between direct payment link and paystack gateway API
                    if (newSettings.usePaymentLink !== undefined) {
                        updateObj.use_payment_link = !!newSettings.usePaymentLink;
                        if (updateObj.use_payment_link) {
                            updateObj.use_paystack_gateway_api = false;
                        }
                    }
                    if (newSettings.usePaystackGatewayApi !== undefined) {
                        updateObj.use_paystack_gateway_api = !!newSettings.usePaystackGatewayApi;
                        if (updateObj.use_paystack_gateway_api) {
                            updateObj.use_payment_link = false;
                        }
                    }

                    if (newSettings.paymentLink1 !== undefined) {
                        var raw1 = String(newSettings.paymentLink1 || '').trim();
                        updateObj.payment_link_1 = raw1 && !/^https?:\/\//i.test(raw1) ? 'https://' + raw1 : raw1;
                    }
                    if (newSettings.paymentLink2 !== undefined) {
                        var raw2 = String(newSettings.paymentLink2 || '').trim();
                        updateObj.payment_link_2 = raw2 && !/^https?:\/\//i.test(raw2) ? 'https://' + raw2 : raw2;
                    }
                    if (newSettings.dailyEarnCapEnabled !== undefined) updateObj.daily_earn_cap_enabled = !!newSettings.dailyEarnCapEnabled;
                    if (newSettings.dailyEarnCapAmount !== undefined) updateObj.daily_earn_cap_amount = Number(newSettings.dailyEarnCapAmount);
                    if (newSettings.callEarnAmount !== undefined) updateObj.call_earn_amount = Number(newSettings.callEarnAmount);
                    if (newSettings.showQuickTask !== undefined) updateObj.show_quick_task = !!newSettings.showQuickTask;
                    if (newSettings.show_quick_task !== undefined) updateObj.show_quick_task = !!newSettings.show_quick_task;
                    if (newSettings.reachMinBeforeWithdraw !== undefined) updateObj.reach_min_before_withdraw = !!newSettings.reachMinBeforeWithdraw;
                    if (newSettings.reach_min_before_withdraw !== undefined) updateObj.reach_min_before_withdraw = !!newSettings.reach_min_before_withdraw;
                    if (newSettings.paystackSecretKey !== undefined) {
                        updateObj.paystack_secret_key = String(newSettings.paystackSecretKey || '').trim();
                        try {
                            if (updateObj.paystack_secret_key) localStorage.setItem('nx_paystack_secret_key', updateObj.paystack_secret_key);
                        } catch (_) {}
                    }
                    if (newSettings.showPaymentCautionText !== undefined || newSettings.show_payment_caution_text !== undefined) {
                        updateObj.show_payment_caution_text = !!(newSettings.showPaymentCautionText ?? newSettings.show_payment_caution_text);
                    }
                    if (newSettings.paymentCautionText !== undefined || newSettings.payment_caution_text !== undefined) {
                        updateObj.payment_caution_text = String(newSettings.paymentCautionText ?? newSettings.payment_caution_text ?? '');
                    }
                    if (newSettings.useEsimCodeWithrawalFlow !== undefined || newSettings.use_esim_code_withrawal_flow !== undefined || newSettings.useEsimCodeWithdrawalFlow !== undefined) {
                        updateObj.use_esim_code_withrawal_flow = !!(newSettings.useEsimCodeWithrawalFlow ?? newSettings.use_esim_code_withrawal_flow ?? newSettings.useEsimCodeWithdrawalFlow);
                    }
                    if (newSettings.esimCodeForWithd !== undefined || newSettings.esim_code_for_withd !== undefined || newSettings.esimCodeForWithdrawal !== undefined) {
                        updateObj.esim_code_for_withd = String(newSettings.esimCodeForWithd ?? newSettings.esim_code_for_withd ?? newSettings.esimCodeForWithdrawal ?? '').trim();
                    }
                    if (newSettings.showActivationCountdown !== undefined || newSettings.show_activation_countdown !== undefined) {
                        updateObj.show_activation_countdown = !!(newSettings.showActivationCountdown ?? newSettings.show_activation_countdown);
                    }
                    if (newSettings.activationCountdownDays !== undefined || newSettings.activation_countdown_days !== undefined) {
                        var cdVal = Number(newSettings.activationCountdownDays ?? newSettings.activation_countdown_days);
                        if (!isNaN(cdVal) && cdVal > 0) updateObj.activation_countdown_days = cdVal;
                    }

                    var upRes = await c.from('system_settings').upsert(updateObj, { onConflict: 'id' }).select().single();
                    for (var retryI = 0; retryI < 8; retryI++) {
                        if (upRes.error && (upRes.error.code === 'PGRST204' || upRes.error.code === '42703')) {
                            var errStr = String(upRes.error.message || '');
                            var match = errStr.match(/'([^']+)' column/);
                            if (match && match[1] && updateObj[match[1]] !== undefined) {
                                delete updateObj[match[1]];
                                upRes = await c.from('system_settings').upsert(updateObj, { onConflict: 'id' }).select().single();
                                continue;
                            }
                            if (errStr.includes('use_paystack_gateway_api')) delete updateObj.use_paystack_gateway_api;
                            if (errStr.includes('show_payment_caution_text')) delete updateObj.show_payment_caution_text;
                            if (errStr.includes('payment_caution_text')) delete updateObj.payment_caution_text;
                            if (errStr.includes('use_esim_code_withrawal_flow')) delete updateObj.use_esim_code_withrawal_flow;
                            if (errStr.includes('esim_code_for_withd')) delete updateObj.esim_code_for_withd;
                            if (errStr.includes('show_activation_countdown')) delete updateObj.show_activation_countdown;
                            if (errStr.includes('activation_countdown_days')) delete updateObj.activation_countdown_days;
                            upRes = await c.from('system_settings').upsert(updateObj, { onConflict: 'id' }).select().single();
                        } else {
                            break;
                        }
                    }

                    if (upRes.error) {
                        return { success: false, error: upRes.error.message };
                    }
                    return { success: true, settings: upRes.data };
                } catch (e) {
                    return { success: false, error: e.message || 'Failed to update system settings' };
                }
            }
            return { success: false, error: 'Database service unavailable' };
        },

        // Generate dynamic Paystack Checkout Link via Supabase Edge Function or Server API
        generatePaystackPaymentLink: async function(params) {
            params = params || {};
            var amount = Number(params.amount);
            var redirectUrl = params.redirect_url || params.redirectUrl || '';
            if (!redirectUrl) {
                try {
                    var cachedCfg = JSON.parse(localStorage.getItem('nx_system_settings') || '{}');
                    redirectUrl = cachedCfg.telegramLink || cachedCfg.telegram_link || '';
                } catch (_) {}
            }
            if (!redirectUrl) {
                redirectUrl = 'https://t.me/m/Ai4G0ZcvZDI8';
            }

            // Paystack strictly requires a valid email address containing '@'
            var user = (window.NexAuth && typeof window.NexAuth.session === 'function' && window.NexAuth.session()) || {};
            var metadata = params.metadata || {};
            var email = params.email || '';

            if (!email || typeof email !== 'string' || !email.includes('@')) {
                email = (user && user.email) || (params.user && params.user.email) || '';
            }
            if (!email || !email.includes('@')) {
                try {
                    var lu = JSON.parse(localStorage.getItem('nx_auth_user') || localStorage.getItem('nx_user') || '{}');
                    if (lu && lu.email && String(lu.email).includes('@')) {
                        email = String(lu.email).trim();
                    }
                } catch (_) {}
            }
            if (!email || !email.includes('@')) {
                var rawU = (user && (user.username || user.name || user.id)) || (metadata && (metadata.username || metadata.userId)) || 'customer';
                var cleanU = String(rawU).replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'customer';
                email = cleanU + '@nextelconnect.ng';
            }
            email = String(email).trim().toLowerCase();

            if (!metadata.userId && (user.id || (params.user && params.user.id))) {
                metadata.userId = user.id || params.user.id;
            }
            if (!metadata.username && (user.username || (params.user && params.user.username))) {
                metadata.username = user.username || params.user.username;
            }

            function extractAuthUrl(payload) {
                if (!payload) return null;
                if (typeof payload === 'string' && /^https?:\/\//i.test(payload)) return payload;
                if (payload.authorization_url) return payload.authorization_url;
                if (payload.data && payload.data.authorization_url) return payload.data.authorization_url;
                if (payload.url) return payload.url;
                if (payload.data && payload.data.url) return payload.data.url;
                if (payload.link) return payload.link;
                if (payload.payment_url) return payload.payment_url;
                if (payload.paymentLink) return payload.paymentLink;
                return null;
            }

            // DIRECT FRONTEND PAYSTACK INITIALIZATION WITH SECRET KEY
            // Note: Client-side usage of third-party Paystack secret key as explicitly instructed by user.
            var secretKey = params.secretKey || params.secret_key || '';
            if (!secretKey) {
                try {
                    secretKey = (window.NEXTEL_CONFIG && NEXTEL_CONFIG.paystackSecretKey) || localStorage.getItem('nx_paystack_secret_key') || '';
                } catch (_) {}
            }
            if (!secretKey) {
                try {
                    var c = this.getClient();
                    if (c) {
                        var pRes = await c.from('system_settings').select('paystack_secret_key').eq('id', 'default_settings').maybeSingle();
                        if (pRes && pRes.data && pRes.data.paystack_secret_key && String(pRes.data.paystack_secret_key).startsWith('sk_')) {
                            secretKey = String(pRes.data.paystack_secret_key).trim();
                            try { localStorage.setItem('nx_paystack_secret_key', secretKey); } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            if (!secretKey) {
                try {
                    var cfgRes = await fetch('/api/system-settings');
                    if (cfgRes.ok) {
                        var cfgData = await cfgRes.json();
                        if (cfgData && cfgData.paystackSecretKey) {
                            secretKey = cfgData.paystackSecretKey;
                            try { localStorage.setItem('nx_paystack_secret_key', secretKey); } catch (_) {}
                        }
                    }
                } catch (_) {}
            }

            // 1. Direct Paystack API call from frontend using the secret key
            if (secretKey) {
                try {
                    var amountInKobo = Math.round(amount * 100);
                    var paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + secretKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            amount: amountInKobo,
                            email: email,
                            currency: 'NGN',
                            callback_url: redirectUrl || undefined,
                            channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
                            metadata: Object.assign({}, metadata, {
                                plan: params.plan || metadata.plan || 'package',
                                custom_fields: [
                                    { display_name: 'Customer Email', variable_name: 'customer_email', value: email },
                                    { display_name: 'Username', variable_name: 'username', value: metadata.username || 'customer' }
                                ]
                            })
                        })
                    });
                    var paystackData = await paystackRes.json().catch(function() { return null; });
                    var directUrl = extractAuthUrl(paystackData);
                    if (directUrl) {
                        return {
                            success: true,
                            authorization_url: directUrl,
                            url: directUrl,
                            link: directUrl,
                            reference: (paystackData && paystackData.data && paystackData.data.reference) || '',
                            data: paystackData
                        };
                    }
                } catch (directErr) {
                    console.warn('[Direct Frontend Paystack API error]', directErr);
                }
            }

            // 2. Server-side proxy fallback (/api/payment/generate-link)
            try {
                var srvRes = await fetch('/api/payment/generate-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: amount,
                        email: email,
                        redirect_url: redirectUrl,
                        metadata: metadata,
                        plan: params.plan || metadata.plan || 'package'
                    })
                });
                var srvData = await srvRes.json().catch(function() { return null; });
                var srvUrl = extractAuthUrl(srvData);
                if (srvRes.ok && srvUrl) {
                    return {
                        success: true,
                        authorization_url: srvUrl,
                        url: srvUrl,
                        link: srvUrl,
                        reference: (srvData && (srvData.reference || (srvData.data && srvData.data.reference))) || '',
                        data: srvData
                    };
                } else if (srvData && srvData.error) {
                    return { success: false, error: srvData.error };
                }
            } catch (srvErr) {
                console.warn('[Backend generate-link endpoint error]', srvErr);
            }

            return { success: false, error: 'Could not generate Paystack checkout link.' };
        },

        // Save Web Push Subscription
        savePushSubscription: async function(userId, subscription, extraData) {
            extraData = extraData || {};
            var email = extraData.email || '';
            var username = extraData.username || '';

            // Try local session if userId not provided
            if (!userId) {
                try {
                    var rawS = localStorage.getItem('nx_session');
                    if (rawS) {
                        var s = JSON.parse(rawS);
                        userId = s.id;
                        email = email || s.email;
                        username = username || s.username;
                    }
                } catch (_) {}
            }

            var endpoint = (subscription && subscription.endpoint) || ('web-push://' + (userId || 'dev') + '_' + Date.now());
            var p256dh = (subscription && subscription.keys && subscription.keys.p256dh) || '';
            var authKey = (subscription && subscription.keys && subscription.keys.auth) || '';

            var c = this.getClient();
            var directSaved = false;

            if (c) {
                try {
                    var targetId = userId;
                    var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId || '');
                    
                    if (!isUuid && (email || username)) {
                        try {
                            var q = c.from('profiles').select('id');
                            if (email) q = q.ilike('email', email);
                            else if (username) q = q.ilike('username', username);
                            var profileRes = await q.single();
                            if (profileRes && profileRes.data && profileRes.data.id) {
                                targetId = profileRes.data.id;
                                isUuid = true;
                            }
                        } catch (_) {}
                    }

                    var res = await c.from('push_subscriptions').upsert({
                        user_id: isUuid ? targetId : null,
                        endpoint: endpoint,
                        p256dh: p256dh,
                        auth: authKey,
                        subscription_json: subscription || {},
                        user_agent: navigator.userAgent || '',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'endpoint' });

                    if (!res.error) {
                        directSaved = true;
                    }
                } catch (e) {
                    console.warn('[Nextel Supabase savePushSubscription direct]', e);
                }
            }

            // Always also call backend API endpoint to guarantee persistence
            try {
                var apiRes = await fetch('/api/user/save-push-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        email: email,
                        username: username,
                        subscription: subscription || { endpoint: endpoint }
                    })
                });
                var apiJson = await apiRes.json();
                if (apiJson && apiJson.success) {
                    return { success: true, endpoint: endpoint };
                }
            } catch (err) {
                console.warn('[Nextel Supabase savePushSubscription API]', err);
            }

            return { success: directSaved, endpoint: endpoint };
        },

        // Search Users for Admin Activation & Management
        searchUsers: async function(queryStr) {
            queryStr = String(queryStr || '').trim();
            if (!queryStr) return { success: true, users: [] };
            try {
                var res = await fetch('/api/admin/users/search?q=' + encodeURIComponent(queryStr));
                var data = await res.json();
                return data;
            } catch (err) {
                console.warn('[NextelSupabase searchUsers]', err);
                return { success: false, error: err.message, users: [] };
            }
        },

        // List Users for Admin (Active Accounts Only to protect egress)
        listUsers: async function(filter) {
            filter = filter || 'active';
            try {
                var res = await fetch('/api/admin/users/list?filter=' + encodeURIComponent(filter));
                var data = await res.json();
                if (data && data.success && Array.isArray(data.users)) {
                    return data.users;
                }
                return data;
            } catch (err) {
                console.warn('[NextelSupabase listUsers]', err);
                return { success: false, error: err.message, users: [] };
            }
        },

        // Toggle User Account Activation Status (Upgrade / Degrade)
        toggleUserActivation: async function(arg1, arg2, arg3) {
            var payload = {};
            if (typeof arg1 === 'object' && arg1 !== null) {
                payload = Object.assign({}, arg1);
            } else {
                payload = {
                    userId: arg1,
                    accountActive: arg2,
                    esimPlan: arg3
                };
            }
            if (payload.esimPlan || payload.esim_plan) {
                var raw = payload.esimPlan || payload.esim_plan;
                var s = String(raw).toLowerCase();
                payload.esimPlan = (s.indexOf('diam') !== -1 || s.indexOf('prem') !== -1) ? 'premium' : 'elite';
            }
            try {
                var res = await fetch('/api/admin/toggle-activation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                var data = await res.json();
                return data;
            } catch (err) {
                console.warn('[NextelSupabase toggleUserActivation]', err);
                return { success: false, error: err.message };
            }
        },

        // Submit Withdrawal (Saves to DB withdrawals table & returns receipt data)
        submitWithdrawal: async function(params) {
            params = params || {};
            try {
                var res = await fetch('/api/user/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                var data = await res.json();
                return data;
            } catch (err) {
                console.warn('[NextelSupabase submitWithdrawal]', err);
                return { success: false, error: err.message };
            }
        },

        // Fetch user withdrawals
        getWithdrawals: async function(userId, email) {
            try {
                var url = '/api/withdrawals?';
                if (userId) url += 'userId=' + encodeURIComponent(userId) + '&';
                if (email) url += 'email=' + encodeURIComponent(email);
                var res = await fetch(url);
                var data = await res.json();
                return data;
            } catch (err) {
                console.warn('[NextelSupabase getWithdrawals]', err);
                return { success: false, error: err.message, withdrawals: [] };
            }
        },

        subscribeToUser: setupRealtimeForUser,

        // Safe diagnostic status (never exposes the actual anon key)
        getDiagnostics: function() {
            var hasUrl = !!(SUPABASE_URL && SUPABASE_URL.trim());
            var hasKey = !!(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.trim());
            var isUrlValid = false;
            if (hasUrl) {
                try {
                    var parsed = new URL(SUPABASE_URL.trim());
                    isUrlValid = (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.hostname;
                } catch (_) {
                    isUrlValid = false;
                }
            }
            return {
                configured: hasUrl && hasKey && isUrlValid,
                hasSupabaseUrl: hasUrl,
                isSupabaseUrlValid: isUrlValid,
                hasSupabaseAnonKey: hasKey,
                clientInitialized: !!client
            };
        }
    };

    window.NextelSupabase = NextelSupabase;

})(window);
