/** Synthetic cartridge files built from the documented layouts, not personal saves. */
export function legacyFixture(kind: "red" | "green" | "gold" | "crystal") {
  const b = new Uint8Array(0x8000);
  const gen = kind === "gold" || kind === "crystal" ? 2 : 1;
  const jp = kind === "green";
  const o = kind === "green"
    ? { name: 0x2598, caught: 0x259e, seen: 0x25b1, money: 0x25ee, tid: 0x25fb, time: 0x2ca0, party: 0x2ed5, check: 0x3594, badges: 0x25f8, current: 0x2842, box: 0x302d }
    : kind === "red"
      ? { name: 0x2598, caught: 0x25a3, seen: 0x25b6, money: 0x25f3, tid: 0x2605, time: 0x2ced, party: 0x2f2c, check: 0x3523, badges: 0x2602, current: 0x284c, box: 0x30c0 }
      : kind === "gold"
        ? { name: 0x200b, caught: 0x2a4c, seen: 0x2a6c, money: 0x23db, tid: 0x2009, time: 0x2053, party: 0x288a, check: 0x2d69, badges: 0x23e4, current: 0x2724, box: 0x2d6c }
        : { name: 0x200b, caught: 0x2a27, seen: 0x2a47, money: 0x23dc, tid: 0x2009, time: 0x2052, party: 0x2865, check: 0x2d0d, badges: 0x23e5, current: 0x2700, box: 0x2d10 };
  const be = (o: number, n: number) => { b[o] = n >> 8; b[o + 1] = n & 255; };
  const name = (o: number) => b.set(jp ? [0x9a, 0xaf, 0x86, 0x50] : [0x80, 0x92, 0x87, 0x50], o);
  name(o.name); be(o.tid, 12345);
  b.set(gen === 1 ? [0x12, 0x34, 0x56] : [1, 0xe2, 0x40], o.money); // 123456
  if (gen === 1) b.set([12, 0, 34, 56], o.time);
  else b.set([1, 44, 34, 56], o.time); // 300h, big endian
  b[o.badges] = 5;
  if (gen === 2) b[o.badges + 1] = 128;
  b[o.party] = 1; b[o.party + 1] = gen === 1 ? 0x99 : 152; b[o.party + 2] = 255;
  const p = o.party + 8;
  b[p] = b[o.party + 1];
  if (gen === 1) {
    be(p + 1, 19); b[p + 3] = 5; b[p + 8] = 33; be(p + 12, 12345);
    b.set([0, 0, 135], p + 14); be(p + 17, 65535); b.set([0x2a, 0xaa, 0xc5], p + 27);
    b[p + 33] = 5; [20, 10, 11, 12, 13].forEach((v, i) => be(p + 34 + i * 2, v));
  } else {
    b[p + 1] = 8; b[p + 2] = 33; be(p + 6, 12345); b.set([0, 0, 135], p + 8);
    be(p + 11, 65535); b.set([0x2a, 0xaa, 0xc5], p + 21); b[p + 27] = 70; b[p + 31] = 5;
    [19, 20, 10, 11, 12, 13, 14].forEach((v, i) => be(p + 34 + i * 2, v));
  }
  name(p + 6 * (gen === 1 ? 44 : 48));
  name(p + 6 * (gen === 1 ? 44 : 48) + 6 * (jp ? 6 : 11));
  const national = gen === 1 ? 1 : 152;
  b[o.caught + ((national - 1) >> 3)] |= 1 << ((national - 1) & 7);
  b[o.seen + ((national - 1) >> 3)] |= 1 << ((national - 1) & 7);
  b[o.box + 1] = 255;
  if (gen === 2) {
    for (let i = 0; i < 14; i++) b[(i < 7 ? 0x4000 : 0x6000) + (i % 7) * 0x450 + 1] = 255;
  }
  const checksum = () => {
    let sum = 0;
    const end = kind === "crystal" ? 0x2b83 : o.check;
    for (let i = gen === 1 ? 0x2598 : 0x2009; i < end; i++) sum += b[i];
    if (gen === 1) b[o.check] = (~sum) & 255;
    else { b[o.check] = sum & 255; b[o.check + 1] = (sum >> 8) & 255; }
  };
  const backup = () => {
    const segments = kind === "crystal" ? [[0x2009, 0x1209, 0xb7a]] : [[0x2009, 0x15c7, 0x226], [0x222f, 0x3d69, 0x1aa], [0x23d9, 0x0c6b, 0x47d], [0x2856, 0x7e39, 0x34], [0x288a, 0x10e8, 0x4df]];
    for (const [from, to, length] of segments) b.set(b.slice(from, from + length), to);
    b.set(b.slice(o.check, o.check + 2), kind === "crystal" ? 0x1f0d : 0x7e6d);
  };
  checksum();
  return { bytes: b, offsets: o, checksum, backup };
}
