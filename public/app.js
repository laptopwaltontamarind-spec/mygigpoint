const tg = window.Telegram?.WebApp;
if(tg) tg.expand();

let currentUser = null;

// ওয়ার্নিং ও সাকসেস মেসেজ দেখানোর হেলপার ফাংশন
function showMessage(elementId, message, isError = true) {
    const box = document.getElementById(elementId);
    if (box) {
        box.innerText = (isError ? '❌ ' : '✅ ') + message;
        box.style.color = isError ? '#ff4d4d' : '#4ade80';
        box.style.background = isError ? 'rgba(255, 77, 77, 0.12)' : 'rgba(74, 222, 128, 0.12)';
        box.style.border = isError ? '1px solid #ff4d4d' : '1px solid #4ade80';
        box.style.display = 'block';
    }
}

// বার্তা মুছে ফেলার ফাংশন
function clearMessages() {
    const errorBoxes = document.querySelectorAll('.error-msg-box');
    errorBoxes.forEach(box => {
        box.style.display = 'none';
        box.innerText = '';
    });
}

// অ্যাপ শুরুতেই সেটিং লোড করা
async function loadSiteSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if(document.getElementById('job-q')) document.getElementById('job-q').innerText = "প্রশ্ন: " + data.dailyJobQuestion;
        if(document.getElementById('verify-bkash-num')) document.getElementById('verify-bkash-num').innerText = data.verificationBkashNumber;
        if(document.getElementById('support-link')) document.getElementById('support-link').href = "https://t.me/" + data.supportTelegram.replace('@', '');
    } catch (err) {
        console.error("Error loading settings:", err);
    }
}
loadSiteSettings();

function showRegister() {
    clearMessages();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLogin() {
    clearMessages();
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// অ্যাকাউন্ট রেজিস্ট্রেশন
async function register() {
    clearMessages();
    const name = document.getElementById('reg-name').value;
    const mobile = document.getElementById('reg-mobile').value;
    const referralId = document.getElementById('reg-ref').value;
    const password = document.getElementById('reg-password').value;

    if (!name || !mobile || !password) {
        return showMessage('register-error', 'সবগুলো ঘর পূরণ করুন!');
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mobile, referralId, password })
        });
        const data = await res.json();
        
        if (data.success) {
            showLogin();
            showMessage('login-error', data.message || 'রেজিস্ট্রেশন সফল হয়েছে! লগইন করুন।', false);
        } else {
            showMessage('register-error', data.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে!');
        }
    } catch (err) {
        showMessage('register-error', 'সার্ভারে সমস্যা হয়েছে! পরবর্তীতে চেষ্টা করুন।');
    }
}

// অ্যাকাউন্ট লগইন
async function login() {
    clearMessages();
    const mobile = document.getElementById('login-mobile').value;
    const password = document.getElementById('login-password').value;

    if (!mobile || !password) {
        return showMessage('login-error', 'মোবাইল নম্বর ও পাসওয়ার্ড প্রদান করুন!');
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            renderDashboard();
        } else {
            showMessage('login-error', data.message || 'মোবাইল নম্বর বা পাসওয়ার্ড ভুল!');
        }
    } catch (err) {
        showMessage('login-error', 'লগইন করতে সমস্যা হচ্ছে!');
    }
}

// ড্যাশবোর্ড আপডেট ও রেন্ডারিং
async function renderDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('app-nav').style.display = 'flex';

    document.getElementById('u-name').innerText = currentUser.name;
    document.getElementById('u-balance').innerText = currentUser.balance;
    document.getElementById('u-refcode').innerText = currentUser.ownReferralCode;

    const statusElem = document.getElementById('u-status');
    const warningBox = document.getElementById('unverified-warning');
    const timerBox = document.getElementById('expire-timer-box');

    // তারিখ হিসাবের সঠিক লজিক
    const today = new Date();
    const expireDate = currentUser.verifiedExpireDate ? new Date(currentUser.verifiedExpireDate) : null;
    
    // isVerified = true হলেই ভেরিফাইড দেখাবে
    const isStillValid = currentUser.isVerified && (!expireDate || expireDate > today);

    if (isStillValid) {
        // ১. একাউন্ট ভেরিফাইড হলে
        const formattedDate = expireDate ? expireDate.toLocaleDateString('en-GB') : "আনলিমিটেড";
        const diffDays = expireDate ? Math.ceil((expireDate - today) / (1000 * 60 * 60 * 24)) : 30;

        statusElem.innerText = "ভেরিফাইড ✅";
        statusElem.style.color = "#28a745";
        if (warningBox) warningBox.style.display = "none";
        
        if (timerBox) {
            timerBox.style.display = "block";
            const expireElem = document.getElementById('u-expire');
            if (expireElem) expireElem.innerText = `${diffDays} দিন বাকি (মেয়াদ: ${formattedDate})`;
        }

        // ভেরিফাই ট্যাবের ভেতর ফর্ম লুকিয়ে সাকসেস মেসেজ শো করা
        const verifyTab = document.getElementById('tab-verify');
        if (verifyTab) {
            verifyTab.innerHTML = `
                <div style="background: rgba(40, 167, 69, 0.15); border: 1px solid #28a745; padding: 20px; border-radius: 14px; color: #4ade80; text-align: center; margin-top: 10px;">
                    <h3>✅ আপনার অ্যাকাউন্ট ভেরিফাইড!</h3>
                    <p style="margin-top: 10px; font-size: 15px; color: #e5e7eb;">আপনার অ্যাকাউন্টের ভেরিফিকেশন মেয়াদ সক্রিয় আছে।</p>
                    <p style="margin-top: 8px; font-weight: bold; font-size: 16px; color: #ffd700;">
                        মেয়াদ শেষ হওয়ার তারিখ: ${formattedDate}
                    </p>
                    <p style="margin-top: 5px; font-size: 13px; color: #9ca3af;">(বাকি আছে: ${diffDays} দিন)</p>
                </div>
            `;
        }
    } else {
        // ২. আনভেরিফাইড বা মেয়াদ শেষ হয়ে গেলে
        statusElem.innerText = "আনভেরিফাইড ❌";
        statusElem.style.color = "#ff4d4d";
        if (warningBox) warningBox.style.display = "block";
        if (timerBox) timerBox.style.display = "none";
        
        switchTab('verify'); // সরাসরি ভেরিফাই ট্যাবে নিয়ে যাবে
    }

    // টিম ও হিস্ট্রি ডাটা লোড
    fetchExtraDetails();
}

// অতিরিক্ত হিস্ট্রি ডাটা (উইথড্র ও টিম লিস্ট)
async function fetchExtraDetails() {
    try {
        const res = await fetch('/api/admin/data');
        const data = await res.json();

        // সার্ভার থেকে ইউজারের লেটেস্ট তথ্য দিয়ে currentUser আপডেট
        if (data.users) {
            const updatedMe = data.users.find(u => u._id === currentUser._id);
            if (updatedMe) {
                currentUser = updatedMe;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
        }

        // ১. টিম/রেফারাল ফিল্টার
        const myTeam = data.users.filter(u => u.referralId === currentUser.ownReferralCode);
        const teamCount = document.getElementById('team-count');
        if (teamCount) teamCount.innerText = myTeam.length;
        
        const teamList = document.getElementById('team-list');
        if (teamList) {
            teamList.innerHTML = myTeam.length ? myTeam.map(t => `
                <tr>
                    <td>${t.name}</td>
                    <td>${t.mobile}</td>
                    <td>${t.isVerified ? '✅ Verified' : '❌ Unverified'}</td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align:center;">কেউ আপনার রেফারে জয়েন করেনি</td></tr>';
        }

        // ২. উইথড্র হিস্ট্রি ফিল্টার
        const myWithdraws = data.withdraws.filter(w => w.userId && (w.userId._id === currentUser._id || w.userId === currentUser._id));
        const withdrawHist = document.getElementById('withdraw-history');
        if (withdrawHist) {
            withdrawHist.innerHTML = myWithdraws.length ? myWithdraws.map(w => `
                <tr>
                    <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                    <td>৳${w.amount}</td>
                    <td><span class="badge bg-${w.status.toLowerCase()}">${w.status}</span></td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align:center;">কোনো উইথড্র রেকর্ড নেই</td></tr>';
        }

        // ৩. মোট আর্নিং ক্যালকুলেশন
        let totalEarned = currentUser.balance;
        myWithdraws.forEach(w => { if(w.status === 'Approved') totalEarned += w.amount; });
        const totalEarnedElem = document.getElementById('u-total-earned');
        if (totalEarnedElem) totalEarnedElem.innerText = totalEarned;

    } catch (e) { console.error("History Error:", e); }
}

// আপডেট করা ট্যাব সুইচিং ফাংশন
function switchTab(tabName) {
    clearMessages();
    const today = new Date();
    const expireDate = currentUser?.verifiedExpireDate ? new Date(currentUser.verifiedExpireDate) : null;
    const isStillValid = currentUser?.isVerified && (!expireDate || expireDate > today);

    // আনভেরিফাইড ইউজারদের জন্য সিকিউরিটি চেক
    if (!isStillValid && tabName !== 'verify' && tabName !== 'home') {
        showMessage('verify-error', 'কাজ, উইথড্র ও টিম অপশন পেতে আগে ৳৫০০ দিয়ে একাউন্ট ভেরিফাই করুন!');
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.getElementById('tab-verify').style.display = 'block';
        highlightNav('verify');
        return;
    }

    // সকল ট্যাব হাইড করা
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');

    // নির্দিষ্ট ট্যাব ওপেন করা
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.style.display = 'block';
    
    // নেভিগেশন বাটনে active ক্লাস যুক্ত করার নতুন লজিক
    highlightNav(tabName);
}

// নেভিগেশন বাটন হাইলাইট করার ৩-বাটন ফ্রেন্ডলি ফাংশন
function highlightNav(tabName) {
    const homeBtn = document.querySelectorAll('.nav-item')[0];
    const verifyBtn = document.getElementById('nav-verify-btn');
    const moreBtn = document.getElementById('nav-more-btn');

    // আগে সব বাটন থেকে active তুলে নেওয়া
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    if (tabName === 'home') {
        if(homeBtn) homeBtn.classList.add('active');
    } else if (tabName === 'verify') {
        if(verifyBtn) verifyBtn.classList.add('active');
    } else {
        // কাজ, উইথড্র, হিস্ট্রি বা টিমে গেলে 'সার্ভিস' বাটন হাইলাইট হবে
        if(moreBtn) moreBtn.classList.add('active');
    }
}

// --- ড্রপডাউন সার্ভিস মেনুর ফাংশনসমূহ ---
function toggleMenu() {
    const menu = document.getElementById('more-menu');
    if (menu) menu.classList.toggle('show');
}

function selectSubTab(tabName) {
    const menu = document.getElementById('more-menu');
    if (menu) menu.classList.remove('show');
    switchTab(tabName);
}

// স্ক্রিনের অন্য কোথাও ক্লিক করলে ড্রপডাউন বন্ধ হওয়া
window.addEventListener('click', function(e) {
    const menuBtn = document.getElementById('nav-more-btn');
    const menuContent = document.getElementById('more-menu');
    
    if (menuBtn && menuContent && !menuBtn.contains(e.target) && !menuContent.contains(e.target)) {
        menuContent.classList.remove('show');
    }
});

// ডেইলি জব সাবমিট করা
async function submitJob() {
    clearMessages();
    const answer = document.getElementById('job-ans').value;
    if (!answer) return showMessage('job-error', 'উত্তর লিখুন!');

    try {
        const res = await fetch('/api/submit-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, answer })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser.balance = data.newBalance;
            document.getElementById('u-balance').innerText = currentUser.balance;
            document.getElementById('job-ans').value = '';
            showMessage('job-error', data.message || 'অভিনন্দন! আপনার উত্তর সঠিক হয়েছে।', false);
            fetchExtraDetails();
        } else {
            showMessage('job-error', data.message || 'ভুল উত্তর! আবার চেষ্টা করুন।');
        }
    } catch (err) {
        showMessage('job-error', 'কাজ জমা দিতে সমস্যা হচ্ছে!');
    }
}

// অ্যাকাউন্ট ভেরিফিকেশন রিকোয়েস্ট
async function submitVerification() {
    clearMessages();
    const bkashSender = document.getElementById('v-bkash').value;
    const trxId = document.getElementById('v-trx').value;

    if (!bkashSender || !trxId) {
        return showMessage('verify-error', 'বিকাশ নম্বর এবং TrxID প্রদান করুন!');
    }

    try {
        const res = await fetch('/api/verify-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, bkashSender, trxId })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('v-bkash').value = '';
            document.getElementById('v-trx').value = '';
            showMessage('verify-error', data.message || 'ভেরিফিকেশন রিকোয়েস্ট সফলভাবে জমা দেওয়া হয়েছে!', false);
        } else {
            showMessage('verify-error', data.message || 'ভেরিফিকেশন সাবমিট করতে সমস্যা হয়েছে!');
        }
    } catch (err) {
        showMessage('verify-error', 'নেটওয়ার্ক সমস্যা! পুনরায় চেষ্টা করুন।');
    }
}

// উইথড্রয়াল রিকোয়েস্ট
async function submitWithdraw() {
    clearMessages();
    const paymentNumber = document.getElementById('w-number').value;
    const amount = Number(document.getElementById('w-amount').value);

    if (!paymentNumber || !amount) {
        return showMessage('withdraw-error', 'পেমেন্ট নম্বর এবং পরিমাণ লিখুন!');
    }

    try {
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, paymentNumber, amount })
        });
        const data = await res.json();

        if (data.success) {
            currentUser.balance = data.newBalance;
            document.getElementById('u-balance').innerText = currentUser.balance;
            document.getElementById('w-number').value = '';
            document.getElementById('w-amount').value = '';
            showMessage('withdraw-error', data.message || 'উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে!', false);
            fetchExtraDetails();
        } else {
            showMessage('withdraw-error', data.message || 'উইথড্র রিকোয়েস্ট ব্যর্থ হয়েছে!');
        }
    } catch (err) {
        showMessage('withdraw-error', 'উইথড্র প্রসেস করতে সমস্যা হয়েছে!');
    }
}

// লগআউট
function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    location.reload();
}

// Auto Login Check
window.onload = () => {
    const saved = localStorage.getItem('user');
    if (saved) {
        currentUser = JSON.parse(saved);
        renderDashboard();
    }
}
