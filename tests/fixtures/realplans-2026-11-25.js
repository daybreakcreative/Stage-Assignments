// The SHAPE of six real Daybreak plans as Planning Center returned them on 2026-11-25: every
// position name, status and record order is real; every person is replaced by a code. Same code =
// same person (so "Keys + Music Director" and "Host + Pastor Baptizing" stay one person), and the
// two real same-first-name pairs keep a shared first name (Nico / Benj) because first-name-only
// matching was one of the defects found. No real name appears in this file or anywhere in the repo.
const SHARED_FIRST = { a27:'Nico', a38:'Nico', a28:'Benj', a32:'Benj' };
const nameOf = code => (SHARED_FIRST[code] || ('P' + code.slice(1))) + ' Q' + code.slice(1);
const rows = list => list.map(([code, position, status], i) => ({ id: 'tm_' + code + '_' + i, attributes: { name: nameOf(code), team_position_name: position, status } }));
const PLANS = {
  // [01] Sunday Service — Nov 29 (baptism Sunday)
  sunday_nov29: [
    ['a01','Vocals','C'],['a02','Vocals','C'],['a03','Vocals','C'],['a04','Music Director','C'],['a05','Keys','C'],
    ['a04','Bass Guitar','C'],['a06','Drums','C'],['a07','Pre Service Prayer','C'],['a08','Worship Leader','C'],
    ['a09','Camera 4','C'],['a10','ProPresenter','C'],['a11','Video Director','C'],['a12','Baptism Participant','C'],
    ['a13','Baptism Host','C'],['a14','Baptism Facilities','C'],['a15','Door Assistant','C'],
    ['a16','Announcement Video Host','C'],['a17','Announcement Video Host','C'],['a18','Pastor Baptizing','C'],
    ['a19','Pastor Baptizing','C'],['a20','Prayer Host','C'],['a21','Pre Service Communion','D'],['a22','Vocals','C'],
    ['a23','Speaker','C'],['a24','Welcome Host','U'],['a08','Pre Service Communion','C'],['a25','Lighting Director','C'],
    ['a26','FOH Audio','C'],['a27','Electric Guitar','C'],['a28','FOH Audio','C'],['a29','Camera 2','U'] ],
  // Sunday Service (Meadowlark) — Nov 29
  meadowlark_nov29: [
    ['a30','Drums','C'],['a31','Vocals','C'],['a32','Bass Guitar','C'],['a33','Worship Leader','C'],['a34','Producer','C'],
    ['a35','Welcome Host','C'],['a16','FOH Audio','C'],['a36','ProPresenter','C'],['a21','Vocals','C'],['a37','Speaker','C'],
    ['a38','Electric Guitar','C'],['a39','Keys','C'] ],
  // [01] Sunday Service — Dec 6
  sunday_dec6: [
    ['a04','Bass Guitar','C'],['a06','Drums','U'],['a40','Keys','C'],['a04','Music Director','C'],['a41','Vocals','C'],
    ['a03','Vocals','C'],['a42','Vocals','C'],['a43','ProPresenter','C'],['a24','Speaker','U'],['a16','FOH Audio','C'],
    ['a44','Video Director','C'],['a10','Video Director','C'],['a01','Vocals','C'],['a38','Electric Guitar','C'],
    ['a29','Camera 2','U'],['a45','Announcement Video Host','C'],['a46','Announcement Video Host','C'],['a08','Worship Leader','C'] ],
  // Special Events (Meadowlark) — Thanksgiving Night of Worship, Nov 25
  thanksgiving_now: [
    ['a47','Electric Guitar','C'],['a03','Vocals','C'],['a04','Music Director','C'],['a01','Vocals','C'],['a05','Vocals','C'],
    ['a37','Host','C'],['a48','Pastors','U'],['a24','Pastors','U'],['a49','Host','C'],['a50','Bass','C'],['a51','Vocals','C'],
    ['a52','Baptism Participant','C'],['a37','Pastor Baptizing','C'],['a49','Pastor Baptizing','U'],['a46','Baptism Host','C'],
    ['a37','Baptism Facilities','C'],['a39','Drums','C'],['a04','Keys','C'],['a09','Audio','C'],['a53','Lyrics','C'],['a16','Producer','C'] ],
  // YTH | Sunday Night — Nov 29
  yth_nov29: [
    ['a39','Keys','C'],['a39','MD','C'],['a54','Bass Guitar','D'],['a55','Electric Guitar','D'],['a56','Electric Guitar','C'],
    ['a57','Drums','C'],['a33','Worship Leader','C'],['a58','Vocals','D'],['a59','Vocals','C'],['a60','ProPresenter','C'],
    ['a61','Lighting Director','D'],['a62','Video Switcher','C'],['a63','Camera 2','C'],['a28','FOH Audio','C'],
    ['a16','YTH Production Lead','C'],['a38','Bass Guitar','C'],['a64','Vocals','C'],['a01','Vocals','C'],['a65','Lighting Director','U'] ],
  // 68 | Sunday Night — Nov 29
  sixeight_nov29: [
    ['a66','Culture Carriers','U'],['a67','Culture Carriers','U'],['a68','Culture Carriers','U'],['a69','Culture Carriers','U'],
    ['a70','Culture Carriers','U'],['a71','Culture Carriers','U'],['a72','Culture Carriers','U'],['a73','Culture Carriers','U'],
    ['a74','Culture Carriers','U'],['a75','Culture Carriers','U'],['a76','Bass','C'],['a30','Drums','C'],['a21','Worship Leader','D'],
    ['a77','Vocals','C'],['a44','FOH Audio','C'],['a78','ProPresenter','C'],['a53','Lead','C'],['a79','Vocals','C'],['a80','Keys','U'],
    ['a80','MD','U'],['a03','Worship Leader','C'],['a45','Message','U'],['a81','Hosts','C'],['a82','Ministry Moment','U'],
    ['a83','Culture Carriers','U'],['a84','Hosts','C'] ],
  // [02] All Church Prayer & Worship — Dec 2
  acpw_dec2: [
    ['a19','Pastors','U'],['a03','Vocals','U'],['a85','Vocals','U'],['a01','Vocals','U'],['a33','Worship Leader','U'],
    ['a33','Acoustic Guitar','U'],['a38','Bass','U'],['a05','Drums','U'],['a39','Keys','U'],['a39','Music Director','U'],
    ['a86','Host','U'],['a53','FOH Audio','U'],['a58','ProPresenter','U'],['a77','Video Director','U'] ],
};
const tm = key => ({ data: rows(PLANS[key]) });
module.exports = { PLANS, tm, nameOf, keys: Object.keys(PLANS) };
