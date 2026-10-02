# CHESS ARENA

Poetic · Dark · Architectural · Bilingual

## 1. Supabase
1. নতুন প্রজেক্ট বানান
2. Authentication → Email/Password চালু করুন
3. SQL Editor-এ `sql/schema.sql` পুরোটা রান করুন
4. Project URL + anon key কপি করুন → `config.js`-এ বসান

## 2. Stockfish
1. https://github.com/nmrugg/stockfish.js থেকে lite single বিল্ড নিন
2. `engine/stockfish.js` + `engine/stockfish.wasm` রাখুন
3. License রাখুন

## 3. Deploy
- GitHub Pages / Netlify / Vercel-এ স্ট্যাটিক ফোল্ডার আপলোড করুন
- Hash routing ব্যবহার করুন (server ছাড়াই কাজ করবে)

## 4. Test
- দুই ব্রাউজারে দুই অ্যাকাউন্ট
- Create Private Game → link কপি → অন্য ব্রাউজারে খুলুন
- মুভ করুন → realtime দেখুন
- AI গেম খেলুন → 3D বোর্ড + কোয়োট দেখুন
