const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- SCHEMAS ---------------- //

const SettingsSchema = new mongoose.Schema({
    maxMemberLimit: { type: Number, default: 100 },
    verificationBkashNumber: { type: String, default: "013637839238" },
    dailyJobQuestion: { type: String, default: "45 + 55 = ?" },
    dailyJobAnswer: { type: String, default: "100" },
    dailyJobReward: { type: Number, default: 12 }, // টাস্ক বোনাস ১২ টাকা
    supportTelegram: { type: String, default: "@AdminSupport" }
});
const Settings = mongoose.model('Settings', SettingsSchema);

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    referralId: { type: String },
    ownReferralCode: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verifiedExpireDate: { type: Date },
    lastJobCompletedDate: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const VerificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bkashSender: String,
    trxId: String,
    amount: { type: Number, default: 110 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Verification = mongoose.model('Verification', VerificationSchema);

const WithdrawSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentNumber: String,
    amount: Number,
    finalAmount: Number,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Withdraw = mongoose.model('Withdraw', WithdrawSchema);

const ResetRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mobile: String,
    name: String,
    status: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const ResetRequest = mongoose.model('ResetRequest', ResetRequestSchema);

// ---------------- ADMIN PAGE ROUTE ---------------- //

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------------- USER ENDPOINTS ---------------- //

app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.json(settings);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, mobile, referralId, password } = req.body;
        let settings = await Settings.findOne() || await Settings.create({});
        const totalUsers = await User.countDocuments();
        
        if (totalUsers >= settings.maxMemberLimit) {
            return res.status(400).json({ success: false, message: "মেম্বার লিমিট শেষ! এডমিনের সাথে যোগাযোগ করুন।" });
        }

        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "মোবাইল নম্বরটি আগেই রেজিস্টার করা হয়েছে!" });
        }

        const ownReferralCode = "REF" + Math.floor(100000 + Math.random() * 900000);
        const newUser = new User({ name, mobile, referralId, password, ownReferralCode });
        await newUser.save();

        res.json({ success: true, message: "রেজিস্ট্রেশন সফল হয়েছে!", userId: newUser._id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { mobile, password } = req.body;
        const user = await User.findOne({ mobile, password });
        if (!user) return res.status(400).json({ success: false, message: "মোবাইল নম্বর বা পাসওয়ার্ড ভুল!" });

        if (user.isVerified && user.verifiedExpireDate && new Date() > new Date(user.verifiedExpireDate)) {
            user.isVerified = false;
            await user.save();
        }

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/reset-password-request', async (req, res) => {
    try {
        const { mobile } = req.body;
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(400).json({ success: false, message: "এই মোবাইল নম্বরে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!" });
        }

        const resetReq = new ResetRequest({
            userId: user._id,
            mobile: user.mobile,
            name: user.name
        });
        await resetReq.save();

        res.json({ success: true, message: "পাসওয়ার্ড রিসেট রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন যোগাযোগ করবে।" });
    } catch (err) {
        res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে!" });
    }
});

app.post('/api/verify-request', async (req, res) => {
    try {
        const { userId, bkashSender, trxId } = req.body;
        // ১. নিশ্চিত ভাবে ১১০ টাকা রিকোয়েস্টে সেট হবে
        const newReq = new Verification({ userId, bkashSender, trxId, amount: 110 });
        await newReq.save();
        res.json({ success: true, message: "ভেরিফিকেশন রিকোয়েস্ট পাঠানো হয়েছে!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/submit-job', async (req, res) => {
    try {
        const { userId, answer } = req.body;
        const user = await User.findById(userId);
        const settings = await Settings.findOne() || await Settings.create({});

        if (!user) return res.status(404).json({ success: false, message: "ইউজার পাওয়া যায়নি" });

        if (!user.isVerified) {
            return res.status(400).json({ success: false, message: "কাজ করতে আগে একাউন্ট ভেরিফাই করুন!" });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (user.lastJobCompletedDate === todayStr) {
            return res.status(400).json({ success: false, message: "আপনি আজকের কাজ ইতোমধ্যে সম্পন্ন করেছেন!" });
        }

        if (answer.trim() !== settings.dailyJobAnswer.trim()) {
            return res.status(400).json({ success: false, message: "উত্তর ভুল হয়েছে! আবার চেষ্টা করুন।" });
        }

        // ২. সরাসরি ফিক্সড ১২ টাকা টাস্ক রিওয়ার্ড প্রদান
        const reward = 12;
        user.balance += reward;
        user.lastJobCompletedDate = todayStr;
        await user.save();

        res.json({ success: true, message: `সঠিক উত্তর! ৳${reward} যোগ করা হয়েছে।`, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, paymentNumber, amount } = req.body;
        const numAmount = Number(amount);
        
        if (isNaN(numAmount) || numAmount < 100) {
            return res.status(400).json({ success: false, message: "সর্বনিম্ন উইথড্র ৳১০০" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "ইউজার পাওয়া যায়নি" });

        if (user.balance < numAmount) {
            return res.status(400).json({ success: false, message: "পর্যাপ্ত ব্যালেন্স নেই!" });
        }

        user.balance -= numAmount;
        await user.save();

        const finalAmount = numAmount * 0.85; // 15% charge
        const reqWithdraw = new Withdraw({ userId, paymentNumber, amount: numAmount, finalAmount });
        await reqWithdraw.save();

        res.json({ success: true, message: "উইথড্র রিকোয়েস্ট সাবমিট করা হয়েছে!", newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------------- ADMIN ENDPOINTS ---------------- //

app.get('/api/admin/dashboard-summary', async (req, res) => {
    try {
        const totalMembers = await User.countDocuments();

        // ৩. সরাসরি Approved হওয়া ডকুমেন্টের সংখ্যা × ১১০ হিসাব করা
        const approvedVerificationsCount = await Verification.countDocuments({ status: 'Approved' });
        const totalAmountReceived = approvedVerificationsCount * 110;

        const approvedWithdraws = await Withdraw.find({ status: 'Approved' });
        const totalWithdrawPaid = approvedWithdraws.reduce((sum, item) => sum + (item.amount || 0), 0);

        res.json({
            success: true,
            totalMembers,
            totalAmountReceived,
            totalWithdrawPaid
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "সামারি ডাটা লোড করতে সমস্যা হয়েছে!" });
    }
});

app.get('/api/admin/data', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        const verifications = await Verification.find().populate('userId').sort({ createdAt: -1 });
        const withdraws = await Withdraw.find().populate('userId').sort({ createdAt: -1 });
        const resetRequests = await ResetRequest.find().sort({ createdAt: -1 });
        let settings = await Settings.findOne() || await Settings.create({});

        res.json({ users, verifications, withdraws, resetRequests, settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/update-settings', async (req, res) => {
    try {
        const { maxMemberLimit, dailyJobQuestion, dailyJobAnswer, verificationBkashNumber, supportTelegram, dailyJobReward } = req.body;
        let settings = await Settings.findOne();
        if (settings) {
            settings.maxMemberLimit = maxMemberLimit;
            settings.dailyJobQuestion = dailyJobQuestion;
            settings.dailyJobAnswer = dailyJobAnswer;
            settings.verificationBkashNumber = verificationBkashNumber;
            settings.supportTelegram = supportTelegram;
            settings.dailyJobReward = 12; // ১২ টাকা ফিক্সড
            await settings.save();
        }
        res.json({ success: true, message: "সেটিংস আপডেট হয়েছে!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/update-balance', async (req, res) => {
    try {
        const { userId, newBalance } = req.body;
        await User.findByIdAndUpdate(userId, { balance: Number(newBalance) });
        res.json({ success: true, message: "ব্যালেন্স পরিবর্তন করা হয়েছে!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/approve-verification', async (req, res) => {
    try {
        const { requestId } = req.body;
        const reqDoc = await Verification.findById(requestId);
        if (!reqDoc || reqDoc.status !== 'Pending') return res.status(400).json({ success: false, message: "অবৈধ রিকোয়েস্ট" });

        reqDoc.status = 'Approved';
        await reqDoc.save();

        const user = await User.findById(reqDoc.userId);
        if (user) {
            user.isVerified = true;
            
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 30);
            user.verifiedExpireDate = expireDate;
            await user.save();

            // রেফার করার জন্য রেফারার ৪০ টাকা বোনাস পাবে
            if (user.referralId) {
                const referrer = await User.findOne({ ownReferralCode: user.referralId });
                if (referrer) {
                    referrer.balance += 40;
                    await referrer.save();
                }
            }
        }

        res.json({ success: true, message: "একাউন্ট ভেরিফাইড এবং রেফারার ৳৪০ বোনাস পেয়েছে!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/update-withdraw-status', async (req, res) => {
    try {
        const { withdrawId, status } = req.body;
        const reqDoc = await Withdraw.findById(withdrawId);
        if (!reqDoc) return res.status(404).json({ success: false, message: "উইথড্র রিকোয়েস্ট পাওয়া যায়নি" });

        if (status === 'Rejected' && reqDoc.status === 'Pending') {
            const user = await User.findById(reqDoc.userId);
            if (user) {
                user.balance += reqDoc.amount;
                await user.save();
            }
        }

        reqDoc.status = status;
        await reqDoc.save();
        res.json({ success: true, message: `উইথড্র স্ট্যাটাস ${status} করা হয়েছে!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Serve Front-end App
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------- SERVER & DATABASE CONNECTION ---------------- //

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://laptopwaltontamarind_db_user:wR7rEVcerDH6NrAQ@cluster0.pdkdipp.mongodb.net/telegramDB?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
    .catch(err => console.log('Database Error:', err));
