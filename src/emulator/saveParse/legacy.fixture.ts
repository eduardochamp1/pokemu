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

/**
 * Saves sintéticos de Gen 2 japonesa e coreana, montados com os offsets de
 * `SAV2Offsets` do PKHeX. Conferem que o leitor e o layout documentado
 * concordam; não substituem um save de verdade dessas edições.
 */
export function gen2VariantFixture(game: "gold" | "crystal", variant: "japanese" | "korean") {
  const b = new Uint8Array(0x8000);
  const jp = variant === "japanese";
  const o = !jp
    ? { time: 0x204d, money: 0x23d3, badges: 0x23dc, current: 0x26fc, party: 0x28cc, caught: 0x2a8e, seen: 0x2aae, end: 0x2dab, check: 0x2dab }
    : game === "crystal"
      ? { time: 0x2034, money: 0x23be, badges: 0x23c7, current: 0x26e2, party: 0x281a, caught: 0x29aa, seen: 0x29ca, end: 0x2ae3, check: 0x2d0d }
      : { time: 0x2034, money: 0x23bc, badges: 0x23c5, current: 0x2705, party: 0x283e, caught: 0x29ce, seen: 0x29ee, end: 0x2c8c, check: 0x2d0d };
  const be = (at: number, n: number) => { b[at] = n >> 8; b[at + 1] = n & 255; };
  const nameLength = jp ? 6 : 11;
  // "ヒョキ" em japonês; em coreano, dois bytes quaisquer por sílaba.
  const name = (at: number) => b.set(jp ? [0x9a, 0xaf, 0x86, 0x50] : [0x0b, 0x01, 0x0b, 0x02, 0x50], at);
  be(0x2009, 12345); name(0x200b);
  b.set([1, 0xe2, 0x40], o.money); // 123456
  b.set([1, 44, 34, 56], o.time); // 300h
  b[o.badges] = 5; b[o.badges + 1] = 128;
  b[o.current] = 2;
  b[o.party] = 1; b[o.party + 1] = 152; b[o.party + 2] = 255;
  const p = o.party + 8;
  b[p] = 152; b[p + 1] = 8; b[p + 2] = 33; be(p + 6, 12345); b.set([0, 0, 135], p + 8);
  be(p + 11, 65535); b.set([0x2a, 0xaa, 0xc5], p + 21); b[p + 27] = 70; b[p + 31] = 5;
  [19, 20, 10, 11, 12, 13, 14].forEach((v, i) => be(p + 34 + i * 2, v));
  name(p + 6 * 48);
  name(p + 6 * 48 + 6 * nameLength);
  b[o.caught + (151 >> 3)] |= 1 << (151 & 7);
  b[o.seen + (151 >> 3)] |= 1 << (151 & 7);
  const boxCount = jp ? 9 : 14, capacity = jp ? 30 : 20, half = jp ? 6 : 7;
  const span = capacity * (1 + 32 + 2 * nameLength) + 4;
  const boxAt = (i: number) => (i < half ? 0x4000 : 0x6000) + (i < half ? i : i - half) * span;
  for (let i = 0; i < boxCount; i++) b[boxAt(i) + 1] = 255;
  // Um Chikorita na última caixa, para o teste alcançar o segundo banco.
  const last = boxAt(boxCount - 1);
  b[last] = 1; b[last + 1] = 152; b[last + 2] = 255;
  const r = last + capacity + 2;
  b[r] = 152; b[r + 2] = 33; b.set([0, 0, 135], r + 8); b[r + 31] = 5;
  const checksum = () => {
    let total = 0;
    for (let i = 0x2009; i < o.end; i++) total += b[i];
    b[o.check] = total & 255; b[o.check + 1] = (total >> 8) & 255;
  };
  const backup = () => {
    const length = o.end - 0x2009;
    b.set(b.slice(0x2009, 0x2009 + length), 0x7209);
    b.set(b.slice(o.check, o.check + 2), 0x7f0d);
  };
  checksum();
  return { bytes: b, offsets: o, checksum, backup, boxCount, capacity };
}
