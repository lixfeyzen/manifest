# Manifest: Panduan Memahami Kode untuk Pemula

Panduan ini menjelaskan kode Manifest yang sesungguhnya, baris demi baris, supaya kamu benar-benar paham dan bisa mempertahankannya saat wawancara. Fokusnya adalah siklus hidup pesanan (order lifecycle) PENDING lalu PAID lalu FULFILLING lalu FULFILLED, dan FAILED bisa dicoba ulang. Setelah membaca, kamu tidak cuma hafal apa yang kode lakukan, tetapi juga tahu kenapa ia dirancang begitu.

## Daftar isi

- [1. Aturan bisnis murni (packages/domain)](#1-aturan-bisnis-murni-packagesdomain)
- [2. Database & skema (packages/db/prisma/schema.prisma)](#2-database--skema-packagesdbprismaschemaprisma)
- [3. Webhook, HMAC & idempotency (apps/api)](#3-webhook-hmac--idempotency-appsapi)
- [4. Worker & fulfillment retry-safe (apps/worker)](#4-worker--fulfillment-retry-safe-appsworker)
- [5. Autentikasi: session, hashing, middleware (apps/api + apps/web)](#5-autentikasi-session-hashing-middleware-appsapi--appsweb)
- [6. Server API & alur data frontend (apps/api + apps/web)](#6-server-api--alur-data-frontend-appsapi--appsweb)

## 1. Aturan bisnis murni (packages/domain)

Sebelum kita lihat kode satu per satu, mari pahami apa itu folder `packages/domain` ini dan kenapa ia ada.

Bayangkan seluruh aplikasi Manifest sebagai sebuah restoran. Ada bagian yang ngurus database, ada yang ngurus jaringan/webhook, ada yang nampilin halaman. Tapi di tengah-tengah itu ada "aturan main", misalnya: "pesanan yang belum dibayar tidak boleh dikirim". Aturan main inilah yang disebut **business rules** (aturan bisnis), dan `packages/domain` adalah tempat khusus untuk menyimpan _hanya_ aturan-aturan itu.

Hal paling penting: paket ini **pure** dan **dependency-free**.

- Pure (murni) = fungsinya hanya menerima input lalu mengembalikan output, tanpa "menyentuh dunia luar". Ia tidak membaca database, tidak memanggil API, tidak melihat jam dinding. Input sama, output selalu sama.
- Dependency-free (tanpa ketergantungan) = ia tidak meng-`import` database, framework web, atau library berat apa pun. Lihat sendiri di setiap file: yang di-import cuma `@manifest/shared` (kumpulan tipe/enum bersama) dan file `errors.js` tetangganya.

**Kenapa begini:** karena murni dan tanpa dependency, aturan bisnis jadi sangat mudah di-unit-test. Unit test = tes kecil yang menguji satu fungsi secara terisolasi. Kita tidak perlu menyalakan database atau server hanya untuk membuktikan bahwa "PENDING tidak boleh langsung jadi FULFILLED". Cukup panggil fungsinya dengan angka/status, lalu cek hasilnya. Inilah cara kita "membuktikan" aturan, bukan sekadar berharap kode benar (no vibe coding).

Sepanjang section ini kita akan terus menyinggung **siklus hidup pesanan (order lifecycle)**:

```
PENDING -> PAID -> FULFILLING -> FULFILLED
                       |
                       v
                     FAILED -> FULFILLING   (retry manual)
```

Artinya: pesanan dibuat (PENDING), lalu dibayar (PAID), lalu mulai diproses/dikirim (FULFILLING), lalu selesai (FULFILLED). Kalau proses gagal di tengah jalan, statusnya jadi FAILED dan bisa dicoba ulang.

---

### 1.1 State machine pesanan: `ALLOWED_TRANSITIONS`, `canTransition`, `assertTransition`

File: `D:\manifest\packages\domain\src\order-status.ts`

Yang pertama kita bahas adalah **state machine** (mesin keadaan). Istilah ini terdengar rumit, tapi maknanya sederhana: sebuah daftar resmi tentang dari keadaan A, pesanan boleh pindah ke keadaan mana saja. Setiap perpindahan disebut **transition (transisi)**. Apa pun yang tidak ada di daftar berarti dilarang.

Inilah daftar resminya:

```ts
const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.FULFILLING],
  [OrderStatus.FULFILLING]: [OrderStatus.FULFILLED, OrderStatus.FAILED],
  [OrderStatus.FAILED]: [OrderStatus.FULFILLING],
  [OrderStatus.FULFILLED]: [],
};
```

Baca per baris seperti membaca tabel "dari, boleh ke":

- `PENDING` boleh pindah hanya ke `PAID`. (Pesanan baru cuma bisa "dibayar".)
- `PAID` boleh pindah hanya ke `FULFILLING`. (Setelah dibayar, mulai diproses.)
- `FULFILLING` boleh pindah ke `FULFILLED` atau `FAILED`. (Proses bisa sukses atau gagal.)
- `FAILED` boleh balik ke `FULFILLING`. (Inilah jalur **retry**, coba lagi pesanan yang gagal.)
- `FULFILLED` daftarnya kosong `[]`. Artinya tidak boleh pindah ke mana-mana lagi, ini keadaan final.

Sekarang bedah tipe datanya, karena ini bagian yang sering bikin pemula bingung:

- `Record<OrderStatus, readonly OrderStatus[]>` artinya: "sebuah objek yang setiap status pesanan-nya jadi key, dan nilainya adalah daftar (array) status tujuan." Karena pakai `Record`, TypeScript memaksa kita mengisi semua 5 status. Kalau ada status baru lupa diisi, kode tidak mau dikompilasi.
- `Readonly<...>` dan `readonly OrderStatus[]` artinya isi tabel ini tidak boleh diubah saat program jalan. Tabel aturan harus tetap, bukan sesuatu yang bisa di-otak-atik di tengah jalan.

Lalu dua fungsi yang memakai tabel ini:

```ts
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

- `canTransition` = "boleh nggak pindah dari `from` ke `to`?" Ia mengambil daftar tujuan yang sah untuk `from` (`ALLOWED_TRANSITIONS[from]`), lalu cek apakah `to` ada di dalamnya (`.includes(to)`).
- Mengembalikan `boolean` (true/false). Fungsi ini tidak melempar error, hanya menjawab ya/tidak. Cocok dipakai untuk menanyakan sesuatu sebelum bertindak.

```ts
export function assertTransition(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
  return to;
}
```

- `assertTransition` = versi "tegas". Kata **assert** artinya "pastikan benar, kalau tidak, hentikan." Kalau transisinya tidak sah, ia melempar error `InvalidOrderTransitionError`.
- Kalau sah, ia mengembalikan `to`. Trik kecil ini memudahkan penulisan di tempat pemanggilan, misalnya `order.status = assertTransition(order.status, OrderStatus.PAID)`, satu baris langsung mengecek dan memberikan status barunya.

**Kenapa begini:** dengan menaruh aturan transisi di satu tabel terpusat, kita mustahil "secara tidak sengaja" memindahkan pesanan ke keadaan yang salah dari berbagai tempat di kode. Semua bagian aplikasi yang ingin mengubah status pesanan harus lewat pintu ini. Pemisahan `canTransition` (bertanya, aman) vs `assertTransition` (memaksa, melempar error) memberi pemanggil pilihan sesuai situasi.

---

### 1.2 Membuktikan aturan dengan tes (contoh konkret)

Sekarang bagian terpenting buat kamu sebagai calon fullstack: bagaimana kita membuktikan aturan di atas benar. Lihat file `order-status.test.ts`:

```ts
it('rejects invalid transitions', () => {
  expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toBe(false);
  expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLING)).toBe(false);
  expect(canTransition(OrderStatus.PAID, OrderStatus.FULFILLED)).toBe(false);
  expect(canTransition(OrderStatus.FULFILLED, OrderStatus.PENDING)).toBe(false);
  expect(canTransition(OrderStatus.FULFILLED, OrderStatus.FULFILLING)).toBe(false);
});
```

Baca pelan-pelan:

- `it('rejects invalid transitions', () => { ... })`, `it(...)` mendefinisikan satu skenario tes. Teks di dalamnya adalah deskripsi yang dibaca manusia: "menolak transisi yang tidak sah."
- `expect(X).toBe(false)`, ini pola dasar unit test: "saya mengharapkan `X` hasilnya `false`." Kalau ternyata bukan false, tes gagal dan kita langsung tahu ada aturan yang bocor.
- Baris pertama membuktikan aturan terpenting siklus hidup: pesanan PENDING tidak boleh langsung loncat ke FULFILLED. Pesanan yang belum dibayar tidak boleh tahu-tahu sudah "selesai dikirim". Tes ini menjaga integritas seluruh `order lifecycle`.

Dan ini contoh menguji jalur yang melempar error:

```ts
it('assertTransition throws InvalidOrderTransitionError on an invalid move', () => {
  expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toThrow(
    InvalidOrderTransitionError,
  );
});
```

- Perhatikan `() => assertTransition(...)` dibungkus jadi fungsi. Kenapa? Karena kita ingin menguji bahwa pemanggilannya melempar error. Kalau ditulis langsung tanpa pembungkus, error-nya keburu meledak sebelum `expect` sempat menangkapnya. Membungkusnya berarti "ini lho aksi yang nanti dijalankan oleh `toThrow`."
- `.toThrow(InvalidOrderTransitionError)` mengecek bukan cuma "ada error", tapi error dengan tipe yang tepat.

**Kenapa begini:** inilah wujud nyata dari "paket murni mudah dites." Tidak ada setup database, tidak ada mock yang ribet, cukup status masuk, hasil keluar. Satu file tes singkat sudah cukup mengunci aturan siklus hidup pesanan, dan kalau suatu hari ada yang tak sengaja merusak tabel `ALLOWED_TRANSITIONS`, tes ini akan langsung berteriak merah.

---

### 1.3 Error bisnis bertipe: `DomainError` dan turunannya

File: `D:\manifest\packages\domain\src\errors.ts`

Saat aturan dilanggar, kita perlu cara melaporkan kesalahan. Tapi tidak semua kesalahan sama. Ada bedanya antara "database lagi mati" (masalah infrastruktur) dan "pesanan ini memang tidak boleh dikirim" (masalah aturan bisnis). File ini membuat **typed error**, error yang punya "jenis" jelas, khusus untuk pelanggaran aturan bisnis.

Induk dari semuanya:

```ts
export class DomainError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.retryable = retryable;
  }
}
```

- `class DomainError extends Error`, kita membuat error sendiri yang mewarisi (extends) error bawaan JavaScript. Jadi ia tetap "error normal", tapi dengan info tambahan.
- `readonly code: string`, sebuah kode mesin yang stabil, misalnya `'INSUFFICIENT_STOCK'`. Pesan teks (`message`) untuk dibaca manusia bisa berubah-ubah, tapi `code` dipakai program/log/respons API untuk mengenali jenis error secara pasti. `readonly` artinya tak bisa diubah setelah dibuat.
- `readonly retryable: boolean`, penanda penting: apakah masuk akal mencoba ulang? Kalau `true`, mencoba lagi mungkin berhasil. Kalau `false`, percuma diulang (aturannya memang melarang). Defaultnya `false`.

Lalu tiga error turunan yang spesifik. Contohnya:

```ts
export class InsufficientStockError extends DomainError {
  constructor(sku: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Insufficient stock for ${sku}: requested ${requested}, available ${available}`,
      false,
    );
    this.name = 'InsufficientStockError';
  }
}
```

- Konstruktornya menerima detail yang relevan (`sku`, jumlah diminta, jumlah tersedia) lalu merangkainya jadi pesan yang informatif. Saat error ini muncul di log, kamu langsung tahu barang apa dan kekurangan berapa.
- Ia memanggil `super(..., false)`, `retryable = false`. Logis: kalau stok memang kurang, mengulang permintaan yang sama tidak akan tiba-tiba memunculkan stok.
- Dua saudaranya: `InvalidOrderTransitionError` (transisi status terlarang) dan `OrderNotFulfillableError` (pesanan dalam status yang tak bisa dikirim), keduanya juga `retryable: false`.

**Kenapa begini:** dengan error bertipe dan ber-`code`, lapisan luar aplikasi (API/worker) bisa mengambil keputusan cerdas. Misalnya: kalau ini `DomainError` dengan `retryable: false`, jangan coba ulang, langsung kabari user/operator. Bandingkan dengan error infrastruktur yang `retryable: true`, yang berarti coba ulang otomatis sebentar lagi. Memisahkan "error karena aturan" dari "error karena teknis" mencegah sistem mencoba ulang hal yang memang mustahil berhasil.

---

### 1.4 Keputusan fulfillment: `decideFulfillment`

File: `D:\manifest\packages\domain\src\fulfillment.ts`

Ketika **worker** (program latar yang memproses pesanan) mengambil sebuah pesanan untuk dikirim, ia harus memutuskan: "sebenarnya apa yang harus kulakukan dengan pesanan berstatus ini?" Keputusan itu adalah aturan bisnis, jadi ditaruh di sini, bukan dicampur ke dalam kode worker.

Pertama, didefinisikan dulu bentuk keputusan yang mungkin:

```ts
export type FulfillmentAction =
  | { kind: 'noop'; reason: 'already_fulfilled' }
  | { kind: 'start'; from: OrderStatus } // perlu transisi PAID/FAILED -> FULFILLING
  | { kind: 'continue' }; // sudah FULFILLING, lanjutkan secara idempoten
```

- Ini disebut **discriminated union** (gabungan bertanda). Artinya: keputusan hanya boleh salah satu dari tiga bentuk ini, dan field `kind` adalah "tanda" yang membedakannya.
- `'noop'` = _no operation_, tidak melakukan apa-apa (pesanan sudah selesai).
- `'start'` = mulai proses, sambil membawa info `from` (status asalnya).
- `'continue'` = lanjutkan proses yang sudah berjalan.

Lalu fungsinya:

```ts
export function decideFulfillment(status: OrderStatus): FulfillmentAction {
  switch (status) {
    case OrderStatus.FULFILLED:
      return { kind: 'noop', reason: 'already_fulfilled' };
    case OrderStatus.PAID:
    case OrderStatus.FAILED:
      return { kind: 'start', from: status };
    case OrderStatus.FULFILLING:
      return { kind: 'continue' };
    case OrderStatus.PENDING:
    default:
      throw new OrderNotFulfillableError(status);
  }
}
```

Bedah per cabang:

- `FULFILLED` jadi `noop`. Pesanan sudah selesai; jika worker kebetulan menjalankannya lagi, ia cukup diam. Ini penting untuk **idempotency** (lihat 1.6): menjalankan dua kali tidak boleh merusak apa pun.
- `PAID` atau `FAILED` jadi `start`. Keduanya butuh dimulai/diulang prosesnya. `FAILED` di sini adalah jalur **retry**: pesanan yang sempat gagal dimulai kembali.
- `FULFILLING` jadi `continue`. Sudah jalan, tinggal dilanjutkan.
- `PENDING` (dan `default` apa pun yang tak terduga) akan melempar `OrderNotFulfillableError`. Pesanan belum dibayar tidak boleh dikirim. Ini menegakkan aturan inti `order lifecycle` di titik kerja yang paling kritis.

**Kenapa begini:** dengan menarik keputusan "apa yang harus dilakukan worker" ke fungsi murni ini, logika worker jadi bersih (worker tinggal jalankan hasil keputusan), dan aturannya bisa dites tanpa menjalankan worker sungguhan. Contoh tesnya membuktikan setiap cabang, termasuk yang penting ini:

```ts
it('refuses to fulfill an unpaid (PENDING) order', () => {
  expect(() => decideFulfillment(OrderStatus.PENDING)).toThrow(OrderNotFulfillableError);
});
```

---

### 1.5 Aritmetika stok: `hasSufficientStock` & `reserveStock`

File: `D:\manifest\packages\domain\src\inventory.ts`

Saat pesanan dikirim, stok barang harus dikurangi. Pengurangan ke database sungguhan dilakukan worker di dalam **transaction** (operasi database yang dijamin "semua-atau-tidak-sama-sekali"). Tapi perhitungan dan aturannya, "cukup nggak stoknya? berapa sisa setelah dikurangi?", ditaruh di sini agar tidak salah hitung.

```ts
export function hasSufficientStock(available: number, requested: number): boolean {
  return requested >= 0 && available >= requested;
}
```

- `hasSufficientStock` = "apakah `available` (stok tersedia) cukup untuk `requested` (jumlah diminta)?"
- Ada dua syarat: `requested >= 0` (tidak boleh minta jumlah negatif, penjagaan dari input ngawur) dan `available >= requested` (stok harus menutupi permintaan). Perhatikan pakai `>=`, jadi meminta tepat sama dengan sisa stok masih dibolehkan.

```ts
export function reserveStock(sku: string, available: number, requested: number): number {
  if (!hasSufficientStock(available, requested)) {
    throw new InsufficientStockError(sku, requested, available);
  }
  return available - requested;
}
```

- `reserveStock` melakukan "pemesanan" stok. Pertama ia mengecek pakai `hasSufficientStock`. Kalau tidak cukup, ia melempar `InsufficientStockError` (error bertipe dari 1.3) lengkap dengan `sku` dan angkanya.
- Kalau cukup, ia mengembalikan stok baru (`available - requested`). Komentar di file menegaskan jaminan utamanya: stok tidak pernah jatuh di bawah nol.

Ada juga penjaga retry:

```ts
export function isAlreadyReserved(existingReservedSkus: ReadonlySet<string>, sku: string): boolean {
  return existingReservedSkus.has(sku);
}
```

- `isAlreadyReserved` mengecek apakah sebuah `sku` sudah pernah di-reserve untuk pesanan ini. Berguna saat **retry**: kalau pesanan diulang, kita tidak mau mengurangi stok dua kali untuk barang yang sama. `ReadonlySet` = kumpulan unik yang tak bisa diubah.

Tesnya membuktikan batas-batas kritis, termasuk batas paling rawan (tepat di angka nol dan kelebihan satu):

```ts
it('allows reserving exactly the remaining stock down to zero', () => {
  expect(reserveStock('SKU-HOODIE', 5, 5)).toBe(0);
});

it('never lets stock go below zero', () => {
  expect(() => reserveStock('SKU-HOODIE', 5, 6)).toThrow(InsufficientStockError);
});
```

**Kenapa begini:** kesalahan hitung stok (oversell, menjual barang yang tak ada) adalah bug bisnis yang mahal. Dengan mengisolasi aritmetikanya ke fungsi murni yang dites di batas-batasnya (0, pas, dan lebih satu), kita "mustahil salah di tempat pemanggilan", kata-kata dari komentar file itu sendiri.

---

### 1.6 Penomoran invoice: `buildInvoiceNumber` & `shouldCreateInvoice`

File: `D:\manifest\packages\domain\src\invoice.ts`

Aturan bisnisnya jelas: satu pesanan punya paling banyak satu invoice. Fulfillment yang diulang tidak boleh membuat invoice kedua.

```ts
export function buildInvoiceNumber(orderId: string, issuedAt: Date): string {
  const yyyy = issuedAt.getUTCFullYear();
  const mm = String(issuedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(issuedAt.getUTCDate()).padStart(2, '0');
  return `INV-${yyyy}${mm}${dd}-${shortOrderId(orderId)}`;
}
```

- Menghasilkan nomor invoice rapi seperti `INV-20260605-1A2B3C4D`.
- `getUTCMonth()` mengembalikan 0 sampai 11 (Januari = 0), makanya `+ 1`. `padStart(2, '0')` menambah nol di depan agar selalu 2 digit (bulan `6` jadi `"06"`).
- **Detail kunci:** tanggal (`issuedAt`) dikirim sebagai parameter, bukan dibaca dari `new Date()` di dalam fungsi. Inilah yang menjaga fungsi tetap **pure**. Kalau ia membaca jam dinding sendiri, hasilnya berubah tiap detik dan mustahil dites secara pasti. Karena tanggalnya kita yang kasih, tes bisa memastikan hasil yang tetap.

```ts
export function shouldCreateInvoice(existingInvoiceId: string | null | undefined): boolean {
  return !existingInvoiceId;
}
```

- "Perlukah buat invoice baru?" Jawabannya: ya, hanya jika belum ada invoice (`existingInvoiceId` bernilai null/undefined). Tanda `!` membalik nilai: kalau ID-nya kosong jadi `true` (buat baru); kalau sudah ada ID jadi `false` (jangan buat lagi).

Tesnya membuktikan dua hal sekaligus, format yang benar dan sifat deterministik (sama input, sama output):

```ts
it('is deterministic for the same order and date', () => {
  const issuedAt = new Date(Date.UTC(2026, 0, 1));
  const a = buildInvoiceNumber('order-abc', issuedAt);
  const b = buildInvoiceNumber('order-abc', issuedAt);
  expect(a).toBe(b);
});
```

**Kenapa begini:** komentar file menjelaskan pembagian tugas dengan jujur, keunikan invoice yang _sesungguhnya_ dijaga oleh **database** lewat `unique constraint` pada `Invoice.orderId` (aturan database yang melarang dua baris dengan orderId sama). Modul murni ini berperan menyediakan nomor yang deterministik dan keputusan "perlu buat atau tidak" yang bisa dites. Database adalah pengaman terakhir; fungsi murni adalah aturan yang bisa dibuktikan.

---

### 1.7 Idempotency webhook: `decideIdempotency`

File: `D:\manifest\packages\domain\src\idempotency.ts`

**Idempotency** = sifat di mana melakukan operasi yang sama berkali-kali memberi hasil yang sama seperti sekali. Ini krusial untuk **webhook**, pemberitahuan dari sistem pembayaran (misal "pesanan X sudah dibayar"). Sistem pembayaran kadang mengirim webhook yang sama dua kali (karena jaringan timeout lalu mereka coba lagi). Kalau kita memprosesnya dua kali, pesanan bisa diproses ganda. Maka kita butuh aturan: "event ini sudah pernah kulihat belum?"

```ts
export function decideIdempotency(
  existingStatus: ProcessedEventStatus | null | undefined,
): IdempotencyDecision {
  if (existingStatus == null) {
    return { kind: 'process' };
  }
  if (existingStatus === ProcessedEventStatus.PROCESSED) {
    return { kind: 'ignore', reason: 'already_processed' };
  }
  if (existingStatus === ProcessedEventStatus.PROCESSING) {
    return { kind: 'ignore', reason: 'in_progress' };
  }
  // Event yang sebelumnya FAILED boleh diproses ulang.
  return { kind: 'process' };
}
```

Aplikasi menyimpan catatan tiap event yang masuk dalam tabel `ProcessedEvent`. Fungsi ini menerima status catatan itu dan memutuskan:

- `existingStatus == null` berarti belum pernah ada catatan, jadi **`process`** (proses, ini event baru). Catatan: `== null` (dua sama dengan) sengaja menangkap baik `null` maupun `undefined` sekaligus.
- `PROCESSED` berarti sudah selesai diproses sebelumnya, jadi **`ignore`** dengan alasan `already_processed`. Ini menangkap webhook duplikat yang datang belakangan.
- `PROCESSING` berarti sedang diproses saat ini juga (duplikat yang datang bersamaan), jadi **`ignore`** dengan alasan `in_progress`. Mencegah dua proses jalan bersamaan untuk event yang sama.
- Sisanya (yaitu `FAILED`) jadi **`process`** lagi. Event yang dulu gagal boleh dicoba ulang.

File ini juga menyiapkan respons standar webhook (`WEBHOOK_PROCESSED` dan `WEBHOOK_IGNORED`) agar endpoint memberi balasan yang konsisten.

Tesnya mengunci keempat skenario, termasuk yang paling halus, duplikat yang datang bersamaan:

```ts
it('ignores a concurrent in-progress duplicate', () => {
  expect(decideIdempotency(ProcessedEventStatus.PROCESSING)).toEqual({
    kind: 'ignore',
    reason: 'in_progress',
  });
});
```

(Perhatikan: untuk membandingkan objek, tes pakai `.toEqual` yang mencocokkan isi, bukan `.toBe` yang mencocokkan apakah objeknya benda yang persis sama di memori.)

**Kenapa begini:** ini adalah pintu masuk paling rawan duplikasi di seluruh `order lifecycle`, transisi dari `PENDING` ke `PAID` dipicu oleh webhook pembayaran. Dengan menaruh keputusan "proses atau abaikan" di fungsi murni yang dites, kita punya jaminan tertulis bahwa webhook ganda tidak akan menggandakan pesanan. Sekali lagi, eksekusi nyata (baca dan tulis ke `ProcessedEvent`) dikerjakan lapisan API; di sini hanya otak keputusannya yang murni dan terbukti.

---

### Ringkasan: kenapa semua aturan ini hidup di paket murni

- **Satu sumber kebenaran.** Aturan siklus hidup (state machine), stok, invoice, dan idempotency terkumpul di satu paket, bukan tersebar di worker/API/UI.
- **Mudah dibuktikan, bukan ditebak.** Karena murni dan tanpa dependency, setiap aturan punya unit test ringan yang jalan tanpa database/server. Ini jantung dari "TRULY understand, no vibe coding": kebenaran kode dijamin oleh tes, bukan oleh harapan.
- **Pemisahan tugas yang sehat.** Paket domain memutuskan _apa yang benar_; lapisan luar (API, worker, database) mengerjakan _bagaimana melaksanakannya_ (transaksi DB, unique constraint, retry). Error bertipe dengan flag `retryable` menjadi bahasa bersama di antara keduanya.

File-file yang dibahas (semua di `D:\manifest\packages\domain\src\`): `order-status.ts`, `errors.ts`, `fulfillment.ts`, `inventory.ts`, `invoice.ts`, `idempotency.ts`, beserta pasangan `*.test.ts`-nya.

## 2. Database & skema (packages/db/prisma/schema.prisma)

Di bab ini kita masuk ke "otak" penyimpanan data Manifest. Semua yang terjadi di aplikasi (order masuk, pembayaran diterima, stok dikurangi, invoice dibuat) pada akhirnya disimpan di database. Kita pakai **PostgreSQL** (database relasional / _relational database_: data disimpan dalam tabel-tabel yang saling terhubung), dan kita menulis skemanya pakai **Prisma**.

Apa itu Prisma? Prisma adalah **ORM** (_Object-Relational Mapping_), sebuah alat yang menjembatani kode TypeScript dengan tabel database. Daripada menulis SQL mentah, kita mendeskripsikan bentuk data sekali di file `schema.prisma`, lalu Prisma:

1. membuatkan tabel SQL-nya untuk kita (lewat _migration_, dibahas nanti),
2. membuatkan kode TypeScript (_Prisma Client_) yang sudah tahu bentuk datanya, sehingga kita dapat _autocomplete_ dan pengecekan tipe.

Mari kita bedah file ini bagian per bagian.

### 2.1 Konfigurasi dasar: generator & datasource

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- `generator client` memberitahu Prisma: "Saat aku jalankan `prisma generate`, hasilkan **Prisma Client** untuk JavaScript/TypeScript." Inilah objek `prisma` yang nanti kita pakai di kode (`prisma.order.create(...)` dan sebagainya).
- `datasource db` mendeskripsikan database tujuan. `provider = "postgresql"` artinya kita pakai PostgreSQL. `url = env("DATABASE_URL")` artinya alamat koneksi database tidak ditulis langsung di file (biar tidak bocor), melainkan dibaca dari **environment variable** bernama `DATABASE_URL`.

**Kenapa begini:** memisahkan konfigurasi (URL database) dari kode adalah praktik standar keamanan. URL database biasanya berisi username/password; menaruhnya di environment variable berarti file skema aman di-commit ke Git tanpa membocorkan kredensial.

### 2.2 Anatomi sebuah model: `User`

Sebelum membahas semua model, kita pelajari satu dulu sebagai contoh, karena pola yang sama berulang di mana-mana.

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions Session[]
}
```

Apa itu "model"? Satu `model` sama dengan satu **tabel** di database. Setiap baris di blok itu sama dengan satu **kolom** (_field_). `User` akan jadi tabel `User` dengan kolom `id`, `email`, `passwordHash`, dst.

Mari baca tiap baris:

- `id String @id @default(uuid())`
  - `String` adalah tipe data kolom (teks).
  - `@id` adalah **primary key** (kunci utama): kolom yang menjadi identitas unik tiap baris. Tidak ada dua user dengan `id` sama.
  - `@default(uuid())` artinya kalau saat membuat user kita tidak mengisi `id`, database/Prisma otomatis mengisinya dengan **UUID** (_Universally Unique Identifier_: string acak panjang seperti `3f2a...-...`, praktis tidak mungkin bentrok).
- `email String @unique`
  - `@unique` adalah **unique constraint** (batasan keunikan): database menolak menyimpan dua baris dengan `email` yang sama. Ini yang mencegah dua akun pakai email kembar.
- `passwordHash String`, kolom teks biasa (kita menyimpan _hash_ password, bukan password asli; dibahas di bab Auth).
- `createdAt DateTime @default(now())`
  - `@default(now())` artinya kalau tidak diisi, otomatis diisi waktu sekarang saat baris dibuat. Jadi kita tahu kapan user mendaftar tanpa harus menuliskannya manual.
- `updatedAt DateTime @updatedAt`
  - `@updatedAt` artinya Prisma otomatis memperbarui kolom ini ke waktu sekarang setiap kali baris di-update. Berguna untuk audit ("kapan terakhir berubah?").
- `sessions Session[]`
  - Ini bukan kolom biasa, tapi **relasi**. `Session[]` (ada tanda `[]`) berarti "satu User bisa punya banyak Session". Ini sisi "satu" dari relasi _one-to-many_. Kolom ini tidak benar-benar ada di tabel database; ia hanya jalan pintas di Prisma agar kita bisa menulis `user.sessions`.

**Kenapa begini:** `@id`, `@default`, `@updatedAt`, dan `@unique` adalah blok bangunan yang akan kita lihat berulang. Setiap model di Manifest hampir selalu punya `id` (UUID), `createdAt`, dan sering `updatedAt`. Pola yang konsisten membuat seluruh skema mudah dibaca.

### 2.3 Relasi dua arah: `Session` dan `onDelete: Cascade`

`User` punya `sessions Session[]`. Sisi sebaliknya ada di `Session`:

```prisma
model Session {
  id        String   @id // opaque random token (also the cookie value)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

- `userId String` adalah **foreign key** (_kunci asing_): kolom yang menyimpan `id` milik User pemilik session ini. Inilah "lem" yang menghubungkan dua tabel.
- `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
  - `@relation(fields: [userId], references: [id])` membaca: "kolom `userId` di tabel ini menunjuk ke kolom `id` di tabel User." Ini melengkapi relasi yang tadi kita lihat dari sisi `User.sessions`.
  - `onDelete: Cascade`, ini penting. Kalau sebuah User dihapus, semua Session miliknya ikut terhapus otomatis. "Cascade" artinya penghapusan "mengalir turun" ke baris anak.

**Kenapa `onDelete: Cascade` penting:** tanpa ini, menghapus User akan gagal (karena masih ada Session yang menunjuk ke User itu, dan database melarang foreign key "menggantung"), atau lebih buruk, meninggalkan baris yatim (_orphan rows_) yang menunjuk ke data yang sudah tiada. Cascade menjaga database tetap konsisten secara otomatis. Pola yang sama dipakai di hampir semua relasi `Order` di Manifest: hapus satu `Order`, maka `OrderItem`, `Payment`, `Invoice`, `OrderEvent`, `FulfillmentJob`, dan `InventoryReservation` miliknya ikut bersih, tidak ada sampah tertinggal.

Dua baris terakhir:

- `@@index([userId])` dan `@@index([expiresAt])` membuat **index** (indeks). Index itu seperti daftar isi buku: mempercepat pencarian baris berdasarkan kolom tertentu. Kita sering mencari session berdasarkan `userId` ("session milik user ini") dan `expiresAt` ("session mana yang sudah kedaluwarsa"), jadi keduanya di-index.

Perhatikan: `@unique`/`@id`/`@index` (satu `@`) menempel pada satu kolom. `@@index`/`@@unique` (dua `@@`) ditulis di level model dan bisa mencakup beberapa kolom sekaligus, ini akan jadi kunci di bagian berikutnya.

### 2.4 Enums: status yang sah hanya itu-itu saja

```prisma
enum OrderStatus {
  PENDING
  PAID
  FULFILLING
  FULFILLED
  FAILED
}
```

Apa itu `enum`? _Enumeration_, tipe data yang nilainya hanya boleh dari daftar tetap. Kolom `status` di `Order` bertipe `OrderStatus`, jadi database menolak nilai apa pun selain lima itu. Tidak mungkin ada typo seperti `"pendng"` atau status liar `"in progress"`.

Inilah siklus hidup order (order lifecycle) yang menjadi inti seluruh aplikasi Manifest:

`PENDING` (order dibuat, belum dibayar) lalu `PAID` (pembayaran sukses) lalu `FULFILLING` (sedang diproses gudang) lalu `FULFILLED` (selesai dikirim). `FAILED` adalah jalur gagal (mis. pembayaran ditolak atau stok habis).

Enum lain mengikuti pola sama, masing-masing menjaga "kosakata" yang sah untuk tabelnya:

- `PaymentStatus`: `SUCCEEDED`, `FAILED`.
- `InvoiceStatus`: hanya `ISSUED` (invoice begitu dibuat langsung dianggap terbit).
- `FulfillmentJobStatus`: `QUEUED` lalu `PROCESSING` lalu `COMPLETED` / `FAILED` (siklus hidup satu pekerjaan di antrian).
- `ProcessedEventStatus`: `PROCESSING`, `PROCESSED`, `FAILED` (dipakai untuk _idempotency_, dibahas di 2.7).

**Kenapa begini:** komentar di baris 2 file ini berkata nilai enum di sini mencerminkan konstanta di `packages/shared/src/constants.ts`. Artinya backend, frontend, dan database sepakat memakai string yang sama persis. Enum membuat aturan ini dipaksakan di level paling dalam (database), bukan cuma harapan di kode.

### 2.5 `Order` sebagai pusat: satu-ke-banyak vs satu-ke-satu

```prisma
model Order {
  id            String      @id @default(uuid())
  customerEmail String
  totalAmount   Int
  status        OrderStatus @default(PENDING)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  items           OrderItem[]
  payment         Payment?
  invoice         Invoice?
  events          OrderEvent[]
  fulfillmentJobs FulfillmentJob[]
  reservations    InventoryReservation[]

  @@index([status])
  @@index([createdAt])
}
```

`Order` adalah model pusat, hampir semua model lain menggantung padanya. Perhatikan dua bentuk relasi yang berbeda:

- `OrderItem[]`, `OrderEvent[]`, `FulfillmentJob[]`, `InventoryReservation[]` pakai `[]`. Ini **one-to-many**: satu order bisa punya banyak item, banyak event, banyak job, banyak reservasi.
- `payment Payment?` dan `invoice Invoice?` pakai `?` (artinya _opsional/boleh kosong_), tanpa `[]`. Ini **one-to-one**: satu order paling banyak punya satu Payment dan satu Invoice. Tanda `?` masuk akal karena order yang masih `PENDING` belum punya payment maupun invoice.

Detail kolom:

- `totalAmount Int` dan nanti `unitPrice`, `amount` semuanya `Int` (bilangan bulat). Uang disimpan sebagai integer (mis. satuan terkecil seperti sen/rupiah penuh), bukan desimal/float. Float bisa menimbulkan error pembulatan (`0.1 + 0.2` tidak sama dengan `0.3`), fatal untuk uang. Integer aman dari masalah itu.
- `status OrderStatus @default(PENDING)`, order baru otomatis berstatus `PENDING`. Ini titik awal siklus hidup tadi.
- `@@index([status])` dan `@@index([createdAt])`, dashboard sering memfilter "tampilkan order yang `FULFILLING`" atau mengurutkan "order terbaru", jadi kedua kolom itu di-index agar query cepat.

**Kenapa begini:** memodelkan `Order` sebagai pusat dengan relasi yang jelas (`?` vs `[]`) membuat aturan bisnis tertanam di skema: "satu order hanya boleh punya satu invoice" bukan sekadar konvensi, tapi dipaksakan database (lihat 2.6).

### 2.6 Constraint yang menahan beban (load-bearing): kenapa retry & duplikat AMAN

Ini bagian terpenting dari seluruh bab. Sistem Manifest _event-driven_ dan punya antrian (queue) dengan **retry** (mencoba ulang saat gagal). Konsekuensinya: operasi yang sama bisa berjalan lebih dari sekali. Misalnya, pesan "order ini sudah dibayar" bisa terkirim dua kali karena jaringan lambat. Kalau kita tidak hati-hati, kita bisa: mengurangi stok dua kali, atau membuat dua invoice untuk satu order.

Solusinya: kita jadikan database sebagai **wasit terakhir**. Lewat unique constraint, percobaan duplikat akan ditolak oleh database, bukan cuma dijaga oleh kode aplikasi (yang bisa salah / kena _race condition_).

#### (a) `@@unique([orderId, sku])` di `InventoryReservation`

```prisma
model InventoryReservation {
  id        String   @id @default(uuid())
  orderId   String
  sku       String
  quantity  Int
  createdAt DateTime @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Guarantees one reservation per order+sku so retries cannot double-deduct stock.
  @@unique([orderId, sku])
  @@index([orderId])
}
```

- `@@unique([orderId, sku])` adalah **composite unique constraint** (batasan unik gabungan dua kolom). Artinya: kombinasi `orderId` + `sku` harus unik. Order yang sama (`orderId`) tidak boleh punya dua baris reservasi untuk barang yang sama (`sku`).
- `sku` adalah _Stock Keeping Unit_, kode unik tiap produk (mis. `"TSHIRT-RED-M"`).

Bayangkan alurnya: order #123 memesan produk `TSHIRT-RED-M`. Saat dibayar, sistem mencatat "reservasi stok: order 123, TSHIRT-RED-M, qty 2" lalu mengurangi stok. Kalau pesan pembayaran masuk dua kali (retry), percobaan kedua mencoba membuat baris `InventoryReservation` dengan `orderId=123, sku=TSHIRT-RED-M` lagi, dan database menolaknya karena melanggar `@@unique([orderId, sku])`. Kode kita menangkap penolakan itu dan berkata "oh, reservasi sudah pernah dibuat, jangan kurangi stok lagi." Stok tidak terpotong dua kali.

#### (b) `@unique` pada `Invoice.orderId`

```prisma
model Invoice {
  id            String        @id @default(uuid())
  orderId       String        @unique
  invoiceNumber String        @unique
  ...
}
```

- `orderId String @unique`, satu order hanya boleh punya satu invoice. Kalau proses pembuatan invoice ter-retry, percobaan kedua membuat invoice untuk `orderId` yang sama akan ditolak. Tidak ada invoice dobel.
- `invoiceNumber String @unique`, nomor invoice juga harus unik (tidak boleh dua invoice bernomor sama).

#### (c) `@unique` ber-tiga di `Payment`

```prisma
model Payment {
  id              String        @id @default(uuid())
  orderId         String        @unique
  providerEventId String        @unique
  idempotencyKey  String        @unique
  ...
}
```

Tiga unique sekaligus, masing-masing menjaga sudut berbeda:

- `orderId @unique`, satu order sama dengan satu payment.
- `providerEventId @unique`, ID event dari penyedia pembayaran (mis. Stripe). Penyedia bisa mengirim webhook yang sama berkali-kali; karena `providerEventId` unik, payment yang sama tidak tercatat dua kali.
- `idempotencyKey @unique`, _idempotency key_ adalah kunci yang kita lampirkan ke satu operasi agar, sekali sukses, pengulangan dengan kunci sama tidak menghasilkan efek baru. Ini jaring pengaman kedua untuk duplikat.

> **Idempotent** = sifat operasi yang, dijalankan sekali atau seratus kali dengan input sama, hasil akhirnya tetap sama. Ini konsep emas untuk sistem dengan retry.

### 2.7 `ProcessedEvent`: catatan "event ini sudah kuproses"

```prisma
model ProcessedEvent {
  id              String               @id @default(uuid())
  idempotencyKey  String               @unique
  providerEventId String               @unique
  status          ProcessedEventStatus
  result          Json?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
}
```

Model ini adalah **buku catatan idempotency** terpusat. Sebelum memproses sebuah event, sistem mencoba menulis satu baris ke `ProcessedEvent` dengan `idempotencyKey` event tersebut.

- Kalau berhasil ditulis, berarti event ini baru, silakan diproses.
- Kalau ditolak karena `idempotencyKey @unique` sudah ada, berarti event ini sudah pernah diproses (atau sedang diproses, lihat `status`). Sistem berhenti dan tidak mengerjakannya lagi.

- `providerEventId @unique`, sama, mencegah event yang sama dari penyedia diproses ulang.
- `result Json?`, kolom bertipe **JSON** yang boleh kosong (`?`). Menyimpan hasil pemrosesan, sehingga kalau permintaan yang sama datang lagi, kita bisa mengembalikan hasil yang persis sama tanpa menjalankan ulang.
- `status ProcessedEventStatus`, `PROCESSING` (sedang dikerjakan), `PROCESSED` (selesai), `FAILED` (gagal). Status `PROCESSING` penting agar dua proses paralel tidak mengerjakan event yang sama bersamaan.

**Kenapa begini:** `Payment`/`Invoice`/`InventoryReservation` mencegah duplikat per jenis data. `ProcessedEvent` mencegah duplikat di pintu masuk, sebelum kerja apa pun dimulai. Berlapis-lapis: kalau satu lapis bocor, lapis berikutnya tetap menahan. Inilah arti "retry/duplikat aman di level database": kita tidak bergantung pada kode aplikasi yang sempurna; kita bergantung pada aturan database yang tidak bisa dilanggar.

### 2.8 Model pendukung: `OrderItem`, `InventoryItem`, `OrderEvent`, `FulfillmentJob`

Singkatnya, dengan pola yang sudah kita kenal:

- `OrderItem`, baris-baris barang dalam satu order (`sku`, `name`, `quantity`, `unitPrice`). Relasi one-to-many ke `Order` dengan `onDelete: Cascade`, di-index `@@index([orderId])`.
- `InventoryItem`, master stok per produk. `sku String @unique` (satu SKU sama dengan satu baris stok), `stock Int` (jumlah tersedia). Inilah yang dikurangi saat reservasi terjadi.
- `OrderEvent`, **jejak audit** (_audit trail_) tiap perubahan order: `type` (jenis event), `payload Json`, `correlationId` (ID untuk menelusuri satu rangkaian event yang berkaitan). Di-index pada `orderId` dan `correlationId` agar mudah ditelusuri.
- `FulfillmentJob`, satu pekerjaan di antrian gudang. `bullJobId String? @unique` (ID job di **BullMQ**, library antrian; opsional dan unik), `attempts Int @default(0)` (berapa kali sudah dicoba), `lastError String?` (pesan error terakhir bila gagal). Inilah yang menggerakkan transisi `FULFILLING` lalu `FULFILLED`.

### 2.9 Apa itu "migration"?

Skema di `schema.prisma` hanyalah **deskripsi yang kita inginkan**. Database asli belum tahu apa-apa sampai kita menerjemahkan deskripsi itu menjadi perintah SQL nyata. Proses itu disebut **migration** (migrasi).

- **Migration** = berkas berisi perintah SQL (`CREATE TABLE`, `ALTER TABLE`, `CREATE UNIQUE INDEX`, dst.) yang mengubah struktur database dari kondisi lama ke kondisi baru.
- Saat kita ubah `schema.prisma` (mis. menambah kolom), kita jalankan `prisma migrate dev`. Prisma membandingkan skema baru dengan database, lalu menghasilkan file migration dan menjalankannya.
- File-file migration disimpan di Git, berurutan. Jadi rekan tim lain (atau server produksi) bisa menjalankan migration yang sama untuk mendapatkan struktur database yang persis sama.

**Kenapa begini:** migration adalah "version control untuk struktur database". Tanpa itu, perubahan skema jadi manual, rawan beda antar lingkungan (laptop vs server), dan tak bisa di-_rollback_. Semua constraint yang kita bahas di 2.6 (unique, cascade, index) baru benar-benar berlaku di database setelah migration yang membuatnya dijalankan.

### 2.10 Satu PrismaClient untuk semua: singleton (packages/db/src/index.ts)

Skema mendefinisikan bentuk data; file ini menyediakan **alat untuk memakainya**.

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- `PrismaClient` adalah objek hasil generate dari skema; lewat dia kita memanggil `prisma.order.create(...)`, `prisma.payment.findUnique(...)`, dsb.
- `const globalForPrisma = globalThis as ...`, `globalThis` adalah objek global yang bertahan walau file kode di-reload. Kita "menitipkan" instance Prisma di sana.
- `globalForPrisma.prisma ?? new PrismaClient(...)`, operator `??` (_nullish coalescing_) berkata: "pakai instance yang sudah dititipkan kalau ada; kalau belum ada (`undefined`), baru buat yang baru." Pola ini disebut **singleton**, memastikan hanya ada satu instance untuk seluruh aplikasi.
- `log: ... ['warn','error'] : ['error']`, saat development tampilkan peringatan dan error; di production cukup error saja (lebih senyap).
- `if (process.env.NODE_ENV !== 'production') { globalForPrisma.prisma = prisma; }`, hanya di non-production kita simpan ke global. Di production tidak ada hot-reload, jadi tidak perlu.

**Kenapa singleton penting:** tiap `new PrismaClient()` membuka koneksi ke database (memakan _connection pool_). Saat development, _hot-reload_ (tsx watch / Next.js memuat ulang kode otomatis tiap kali kita save) bisa membuat puluhan PrismaClient baru, menghabiskan kuota koneksi, lalu database menolak koneksi baru. Singleton mencegah ini dengan menggunakan ulang satu instance.

Dua baris terakhir file:

```ts
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
```

Ini **re-export**: meneruskan semua tipe dan enum hasil generate Prisma (mis. `OrderStatus`, `PaymentStatus`, tipe `Order`) lewat satu pintu, yaitu paket `@manifest/db`. Jadi paket lain cukup menulis `import { prisma, OrderStatus } from '@manifest/db'`, tidak perlu menjangkau langsung ke `@prisma/client`.

**Kenapa begini:** satu sumber kebenaran (_single source of truth_). Kalau suatu hari kita ganti ORM atau ubah konfigurasi, kita cukup mengubah satu file ini, bukan ratusan baris import di seluruh proyek.

---

**Ringkasan kaitan ke gambar besar:** skema ini menulis aturan siklus hidup order langsung ke database. `OrderStatus` menjaga transisi `PENDING` lalu `PAID` lalu `FULFILLING` lalu `FULFILLED`, relasi `onDelete: Cascade` menjaga kebersihan data, dan deretan unique constraint (`@@unique([orderId, sku])`, `Invoice.orderId`, `Payment`, `ProcessedEvent`) adalah fondasi yang membuat sistem _event-driven_ dengan retry tetap aman: percobaan ganda ditolak oleh database itu sendiri, bukan sekadar diharapkan tidak terjadi oleh kode.

## 3. Webhook, HMAC & idempotency (apps/api)

Bagian ini adalah jantung keandalan (reliability) dari seluruh proyek. Di sinilah uang "masuk": payment provider (anggap saja seperti Stripe atau Midtrans) memberi tahu sistem kita bahwa sebuah order sudah dibayar. Dari satu pesan itu, order berpindah dari **PENDING** lalu **PAID**, lalu kita jadwalkan proses fulfillment (pengiriman/penyelesaian pesanan).

Istilah dasar dulu:

- **Webhook** = "telepon balik". Alih-alih kita terus-menerus bertanya ke provider "sudah dibayar belum?", provider yang menelepon kita lewat sebuah HTTP request begitu ada kejadian. Endpoint kita: `POST /webhooks/payment`.
- **HMAC** = cara membuktikan pesan itu _benar_ dari provider dan _tidak diubah_ di tengah jalan (kita bahas di bawah).
- **Idempotency** = jaminan bahwa memproses pesan yang sama dua kali punya efek yang sama seperti memproses sekali. Ini bintang utama bab ini.

Alur besarnya, dari pesan masuk sampai selesai:

1. Parse JSON tapi simpan raw body. 2. Verifikasi tanda tangan HMAC. 3. Validasi bentuk data dengan Zod. 4. Gerbang idempotency (cek apakah sudah pernah diproses). 5. Satu transaksi database (payment, order jadi PAID, job fulfillment). 6. Masukkan kerja lambat ke antrian (BullMQ). 7. Tandai event selesai.

Ada pembagian tugas yang sengaja dibuat: `webhook.ts` (lapisan HTTP) tipis, hanya validasi dan menerjemahkan error ke kode status. Semua logika bisnis ada di `webhook-service.ts` supaya bisa dites tanpa HTTP.

---

### 3.1 Menyimpan raw body (syarat mutlak HMAC)

```ts
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  (req as { rawBody?: string }).rawBody = body as string;
  if (!body) return done(null, undefined);
  try {
    done(null, JSON.parse(body as string));
  } catch {
    const err = new Error('Invalid JSON') as Error & { statusCode?: number };
    err.statusCode = 400;
    done(err, undefined);
  }
});
```

- **`addContentTypeParser`** = memberi tahu Fastify (framework HTTP yang dipakai) cara membaca body request dengan `Content-Type: application/json`. Normalnya Fastify langsung mengubah JSON jadi objek dan membuang teks aslinya.
- **`{ parseAs: 'string' }`** = "berikan saya body sebagai string mentah dulu". `body` di sini adalah teks asli, byte demi byte, persis seperti yang dikirim provider.
- **`req.rawBody = body`** = kita selipkan teks mentah itu ke object request supaya bisa dipakai nanti untuk hitung HMAC.
- Lalu `JSON.parse(body)` mengubah teks jadi objek (lewat `done(null, ...)`), atau kalau gagal kita lempar error 400 (`Invalid JSON`).

**Kenapa begini:** HMAC harus dihitung atas byte yang persis sama dengan yang ditandatangani pengirim. Kalau kita biarkan Fastify parse ke objek lalu kita `JSON.stringify` ulang, urutan field atau spasi bisa berbeda sedikit, dan tanda tangan jadi tidak cocok walau datanya benar. Maka: simpan raw body sebelum apa pun menyentuhnya. Perhatikan juga komentarnya, parser ini _scoped to this plugin only_, jadi hanya endpoint webhook yang menyimpan raw body, bukan seluruh aplikasi.

---

### 3.2 Verifikasi tanda tangan HMAC (`hasValidSignature`)

```ts
function hasValidSignature(req: FastifyRequest): boolean {
  const provided = req.headers['x-manifest-signature'];
  const raw = (req as { rawBody?: string }).rawBody ?? '';
  if (typeof provided !== 'string' || !provided) return false;
  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(raw).digest('hex');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Mari pelan-pelan. **HMAC-SHA256** itu seperti "stempel rahasia": pengirim dan kita sama-sama tahu satu kata sandi rahasia (`WEBHOOK_SECRET`). Pengirim menghitung stempel dari (rahasia + isi pesan) dan menempelkannya di header. Kita hitung ulang dengan rahasia yang sama; kalau hasilnya sama, berarti (a) pesan benar dari pihak yang tahu rahasia, dan (b) isi pesan tidak diubah.

- **`provided`** = stempel yang dikirim provider, ada di header `x-manifest-signature`.
- **`raw`** = body mentah yang tadi kita simpan. `?? ''` artinya kalau tidak ada, pakai string kosong (biar tidak crash).
- **`if (typeof provided !== 'string' || !provided) return false`** = kalau header hilang atau bukan string tunggal, langsung tolak. (Header bisa jadi array kalau dikirim ganda, itu pun ditolak.)
- **`createHmac('sha256', env.WEBHOOK_SECRET).update(raw).digest('hex')`** = inilah perhitungan stempel kita sendiri: algoritma SHA256, kunci rahasia dari env, di-update dengan raw body, lalu dijadikan teks heksadesimal.
- **`Buffer.from(...)`** = mengubah string jadi deretan byte, karena fungsi perbandingan aman bekerja di level byte.
- **`a.length === b.length && timingSafeEqual(a, b)`** = bandingkan. Kalau panjang beda langsung gagal; kalau sama, pakai `timingSafeEqual`.

**Kenapa `timingSafeEqual`, bukan `a === b` biasa?** Ini melindungi dari timing attack. Perbandingan string biasa berhenti di karakter pertama yang beda, jadi makin "benar" tebakan penyerang, makin lama waktunya, dan dari selisih waktu itu penyerang bisa menebak stempel karakter demi karakter. `timingSafeEqual` selalu memakan waktu sama berapa pun isinya, jadi tidak membocorkan informasi lewat waktu. (Cek `a.length === b.length` dulu karena `timingSafeEqual` melempar error kalau panjang dua buffer beda.)

Di handler, ini dipakai paling awal:

```ts
if (!hasValidSignature(req)) {
  return reply.status(401).send({ error: 'Invalid or missing webhook signature' });
}
```

**401 Unauthorized** = "kamu tidak terbukti berhak". Pesan yang tanda tangannya salah ditolak sebelum logika bisnis apa pun jalan.

Rahasianya sendiri diatur di `env.ts`:

```ts
WEBHOOK_SECRET: z.string().min(8).default(DEV_WEBHOOK_SECRET),
// ...
.refine((e) => e.NODE_ENV !== 'production' || e.WEBHOOK_SECRET !== DEV_WEBHOOK_SECRET, {
  message: 'WEBHOOK_SECRET must be set to a strong value in production', ...
})
```

- Saat development boleh pakai nilai default `'dev-webhook-secret-change-me'` (yang juga dipakai oleh "penanda tangan" tiruan di sisi web, lihat komentar di `env.ts`).
- **`.refine(...)`** = aturan tambahan: di `production`, dilarang memakai default itu. Kalau tetap dipakai, aplikasi langsung mati saat start dengan pesan jelas. **Kenapa begini:** lebih baik gagal keras saat boot daripada diam-diam jalan dengan rahasia yang bocor publik.

---

### 3.3 Validasi bentuk data dengan Zod

```ts
const parsed = paymentWebhookSchema.safeParse(req.body);
if (!parsed.success) {
  return reply.status(400).send({
    error: 'Invalid webhook payload',
    details: parsed.error.flatten().fieldErrors,
  });
}
```

**Zod** = pustaka untuk memvalidasi dan mendeskripsikan bentuk data. Skemanya (di `packages/shared/src/schemas.ts`):

```ts
export const paymentWebhookSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  type: z.literal('payment.succeeded'),
  amount: z.number().int().nonnegative('amount must be a non-negative integer'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  correlationId: z.string().min(1, 'correlationId is required'),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
```

- Setiap field punya aturan: `eventId`/`orderId`/`idempotencyKey`/`correlationId` harus string tak kosong; `type` harus persis literal `'payment.succeeded'`; `amount` harus bilangan bulat tak negatif.
- **`safeParse`** = mencoba memvalidasi tanpa melempar exception; mengembalikan `{ success, data }` atau `{ success, error }`. Kalau gagal, balas **400 Bad Request** dengan rincian error per field.
- **`z.infer<...>`** = trik TypeScript: tipe `PaymentWebhookInput` otomatis diturunkan dari skema. Jadi aturan validasi dan tipe statis tidak pernah beda, satu sumber kebenaran. Tipe inilah yang dipakai service di bawah.

**Kenapa begini:** verifikasi HMAC membuktikan pesan _otentik_, tapi belum tentu _bentuknya benar_. Zod memastikan struktur sesuai sebelum kita menyentuh database. Urutannya penting: HMAC dulu (otentik?), baru Zod (valid?). Jangan repot memvalidasi data dari pengirim yang belum terbukti sah.

`correlationId` patut dicatat: ini ID yang "ikut" menelusuri satu kejadian melintasi webhook, service, sampai worker, supaya log bisa dirangkai (lihat `withCorrelation(input.correlationId)` di service).

---

### 3.4 Gerbang idempotency: konsep bintang

Sebelum kode, pahami masalahnya dulu. Webhook itu **at-least-once delivery**: provider berjanji mengirim pesan _minimal_ sekali, bukan _tepat_ sekali. Jika koneksi putus sebelum mereka menerima balasan 200 kita, mereka mengirim ulang pesan yang sama. Tanpa pengaman, satu pembayaran bisa: membuat dua baris payment, men-charge dua kali, membuat dua job fulfillment, dan akhirnya dua invoice. Itu bencana.

**Idempotency** = membuat "memproses N kali" berefek sama dengan "memproses sekali". Caranya: setiap event punya **`idempotencyKey`** yang unik dan stabil. Kita catat key yang sudah diproses di tabel **`ProcessedEvent`**, lalu cek tabel itu sebelum bertindak.

Pertama, kita pasti menemukan order-nya dulu:

```ts
const order = await prisma.order.findUnique({ where: { id: input.orderId } });
if (!order) {
  throw new OrderNotFoundError(input.orderId);
}
```

`OrderNotFoundError` nanti diterjemahkan ke **404** di handler HTTP. (Pemisahan rapi: service melempar error domain, handler memetakan ke status HTTP.)

Lalu, bahkan sebelum gerbang, kita selalu mencatat bahwa webhook _diterima_:

```ts
await writeEvent(prisma, {
  orderId: order.id,
  type: OrderEventType.PAYMENT_WEBHOOK_RECEIVED,
  ...
});
```

**Kenapa begini:** salah satu aturan bisnis proyek ini adalah timeline lengkap, setiap order punya jejak audit semua kejadian, termasuk duplikat. "Diterima" dicatat tanpa syarat; apakah kemudian diproses atau diabaikan, dicatat terpisah.

Sekarang gerbangnya:

```ts
const existing = await prisma.processedEvent.findUnique({
  where: { idempotencyKey: input.idempotencyKey },
});
const decision = decideIdempotency(existing?.status);

if (decision.kind === 'ignore') {
  log.info({ reason: decision.reason }, 'Duplicate payment webhook ignored');
  await writeEvent(prisma, {
    orderId: order.id,
    type: OrderEventType.DUPLICATE_EVENT_IGNORED,
    ...
  });
  return WEBHOOK_IGNORED;
}
```

- **`findUnique({ where: { idempotencyKey } })`** = cari apakah key ini sudah pernah tercatat. `idempotencyKey` punya **unique constraint** di database (penting untuk langkah race nanti).
- **`decideIdempotency(existing?.status)`** = fungsi domain murni yang memutuskan dari _status_ event yang ada: apakah kita harus mengabaikan (`ignore`) atau memproses. `existing?.status` jadi `undefined` kalau belum pernah ada (key `?` berarti "kalau `existing` null, jangan crash, hasilnya undefined"). Logika keputusannya sengaja dipisah ke `@manifest/domain` supaya bisa dites tanpa database.
- Jika keputusannya **`ignore`**: catat `DUPLICATE_EVENT_IGNORED` (untuk timeline) dan kembalikan `WEBHOOK_IGNORED`. Tidak ada payment baru, tidak ada job baru. Inilah idempotency yang bekerja: duplikat masuk, tidak terjadi apa-apa yang merusak, balasan tetap sukses.

---

### 3.5 Satu `$transaction` atomik (klaim event, payment, order jadi PAID, dan job)

Kalau event ini benar-benar baru, kita lakukan perubahan inti secara atomik.

```ts
const jobId = fulfillmentJobId(order.id);
try {
  await prisma.$transaction(async (tx) => {
    await tx.processedEvent.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        providerEventId: input.eventId,
        status: ProcessedEventStatus.PROCESSING,
      },
    });

    await tx.payment.create({ data: { orderId: order.id, /* ...amount, status: SUCCEEDED... */ } });

    await tx.order.update({
      where: { id: order.id },
      data: { status: assertTransition(order.status as OrderStatus, OrderStatus.PAID) },
    });

    await writeEvent(tx, { orderId: order.id, type: OrderEventType.PAYMENT_SUCCEEDED, ... });

    await tx.fulfillmentJob.create({
      data: { orderId: order.id, status: FulfillmentJobStatus.QUEUED, bullJobId: jobId },
    });
  });
}
```

**`$transaction`** = "semua perubahan ini terjadi bersama, atau tidak sama sekali". Inilah **atomicity**: kalau salah satu langkah gagal di tengah, semua di-batalkan (rollback). Empat hal di dalamnya:

1. **`tx.processedEvent.create({ status: PROCESSING })`**, klaim event lebih dulu. Ini langkah paling halus. Karena `idempotencyKey` unik, _baris ini_ yang menjadi penjaga ras (race guard). Kita tandai `PROCESSING` (sedang dikerjakan), bukan langsung `PROCESSED`.
2. **`tx.payment.create(...)`**, catat pembayaran (amount, `status: SUCCEEDED`, plus `rawPayload` payload mentah untuk audit).
3. **`tx.order.update(... assertTransition(order.status, OrderStatus.PAID))`**, pindahkan order ke **PAID**. Perhatikan ia tidak menulis `'PAID'` mentah; ia memanggil **`assertTransition`**, mesin keadaan (state machine) domain yang memastikan transisi PENDING lalu PAID itu sah. Kalau order ternyata sudah di status yang tidak boleh pindah ke PAID, ia melempar error dan transaksi rollback. Ini menghubungkan langsung ke lifecycle: PENDING lalu PAID terjadi tepat di sini.
4. **`tx.fulfillmentJob.create({ status: QUEUED, bullJobId: jobId })`**, buat catatan job fulfillment di database dengan status QUEUED. `jobId = fulfillmentJobId(order.id)` = ID yang deterministik (diturunkan dari `order.id`), bukan acak.

Perhatikan semua memakai `tx`, bukan `prisma`, artinya semua ikut transaksi yang sama. (Bahkan `writeEvent(tx, ...)` ikut.)

**Kenapa begini:** lihat komentar di service. Tanpa satu transaksi, kegagalan parsial bisa meninggalkan order "PAID" tanpa baris payment, atau payment tanpa job. Dengan transaksi, keadaan database selalu konsisten: entah keempatnya ada, entah tak satu pun.

**Kenapa `jobId` deterministik?** Karena BullMQ (antrian job) juga punya idempotency sendiri lewat job ID. Kalau kita enqueue dengan ID yang sama dua kali, BullMQ menolak duplikat. Jadi `order.id` menghasilkan `jobId` yang sama, satu job saja, lapisan pertahanan kedua.

---

### 3.6 Menangani ras P2002 (dua webhook identik tiba bersamaan)

Gerbang di 3.4 menangani duplikat yang datang _berurutan_. Tapi bagaimana kalau dua salinan tiba di saat yang nyaris sama? Keduanya bisa lolos `findUnique` (sama-sama belum melihat baris ProcessedEvent), lalu sama-sama mencoba `create`. Di sinilah unique constraint menyelamatkan kita:

```ts
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    log.info('Concurrent duplicate webhook ignored (unique constraint)');
    await writeEvent(prisma, {
      orderId: order.id,
      type: OrderEventType.DUPLICATE_EVENT_IGNORED,
      correlationId: input.correlationId,
      payload: { idempotencyKey: input.idempotencyKey, reason: 'concurrent' },
    });
    return WEBHOOK_IGNORED;
  }
  throw error;
}
```

- **`P2002`** = kode error Prisma untuk pelanggaran unique constraint. Karena `tx.processedEvent.create` adalah langkah pertama dalam transaksi, request yang kalah lomba akan gagal di sana: key-nya sudah dipakai pemenang.
- Kita tangkap _khusus_ P2002, perlakukan sebagai duplikat: catat `DUPLICATE_EVENT_IGNORED` dengan `reason: 'concurrent'`, kembalikan `WEBHOOK_IGNORED`. Yang kalah lomba seluruh transaksinya rollback, jadi tidak ada payment/job ganda.
- **`throw error`** di akhir = kalau errornya _bukan_ P2002 (misalnya database mati), jangan ditelan, lempar naik supaya handler membalas **500** dan masalah nyata terlihat.

**Kenapa begini:** ini pola klaim dulu di langkah pertama transaksi. Database (lewat unique constraint) menjadi wasit tunggal yang menentukan siapa pemenang, bahkan di bawah konkurensi tinggi. `findUnique` di 3.4 hanya optimasi cepat untuk kasus umum; jaminan kebenaran sesungguhnya ada di unique constraint plus penanganan P2002 ini. Inilah yang membuat gerbang idempotency benar-benar _race-safe_.

---

### 3.7 Enqueue ke BullMQ & finalisasi

Setelah transaksi **commit** (berhasil permanen), barulah kita kerjakan bagian lambat dan menutup event:

```ts
await enqueueFulfillment(order.id, input.correlationId, jobId);

await writeEvent(prisma, {
  orderId: order.id,
  type: OrderEventType.FULFILLMENT_QUEUED,
  correlationId: input.correlationId,
  payload: { jobId },
});

await prisma.processedEvent.update({
  where: { idempotencyKey: input.idempotencyKey },
  data: {
    status: ProcessedEventStatus.PROCESSED,
    result: WEBHOOK_PROCESSED as unknown as Prisma.InputJsonValue,
  },
});

return WEBHOOK_PROCESSED;
```

- **`enqueueFulfillment(...)`** = memasukkan pekerjaan fulfillment ke **BullMQ** (antrian job berbasis Redis). Fulfillment itu lambat (memanggil "gudang", buat invoice, dll), jadi tidak dikerjakan di dalam request webhook. Webhook hanya bilang "tolong kerjakan ini nanti" lalu balas cepat. `jobId` deterministik tadi dipakai di sini sebagai ID job BullMQ.
- **`writeEvent(... FULFILLMENT_QUEUED)`** = catat di timeline bahwa job sudah diantrikan.
- **`processedEvent.update({ status: PROCESSED })`** = ubah status klaim dari `PROCESSING` menjadi `PROCESSED`, dan simpan `result`. Sekarang setiap webhook duplikat di masa depan akan melihat status `PROCESSED` dan diabaikan oleh `decideIdempotency`.
- **`return WEBHOOK_PROCESSED`**, handler membalas **200 OK**, memberi tahu provider "diterima, jangan kirim ulang".

**Kenapa enqueue di luar transaksi?** Karena BullMQ/Redis adalah sistem terpisah dari database, ia tidak bisa ikut dalam `$transaction` Postgres. Kalau kita enqueue _di dalam_ transaksi lalu transaksi rollback, job sudah terlanjur masuk antrian (tidak bisa ditarik balik). Maka polanya: commit database dulu (kebenaran inti aman), baru enqueue. Inilah kenapa status di-set dua tahap, `PROCESSING` saat klaim, `PROCESSED` setelah benar-benar selesai diantrikan.

---

### 3.8 Penerjemahan error di handler HTTP

```ts
try {
  const result = await processPaymentWebhook(parsed.data);
  return reply.status(200).send(result);
} catch (error) {
  if (error instanceof OrderNotFoundError) {
    return reply.status(404).send({ error: error.message });
  }
  req.log.error({ err: error }, 'Failed to process payment webhook');
  return reply.status(500).send({ error: 'Internal server error' });
}
```

Handler hanya memetakan error domain ke kode HTTP: `OrderNotFoundError` jadi **404**, error tak terduga lain jadi **500** (sambil dicatat ke log untuk diselidiki). Detail internal tidak bocor ke pemanggil, hanya pesan generik "Internal server error".

**Kenapa begini:** memisahkan "bahasa bisnis" (kelas error domain) dari "bahasa HTTP" (kode status) menjaga service tetap bisa dites tanpa HTTP, dan handler tetap tipis. Inilah arti komentar _"This handler is intentionally THIN"_.

---

### Ringkasan & koneksi ke lifecycle

Satu webhook valid menggerakkan order PENDING lalu PAID dan menjadwalkan langkah berikutnya (FULFILLING lalu FULFILLED dikerjakan oleh worker dari antrian). Tiga lapis pertahanan menjaganya tetap benar walau pesan datang berulang atau bersamaan:

1. **HMAC + Zod**, hanya pesan otentik dan berbentuk benar yang lolos.
2. **Gerbang idempotency** (`ProcessedEvent` + `decideIdempotency`), duplikat berurutan diabaikan.
3. **Unique constraint + P2002**, duplikat bersamaan (race) diabaikan; satu transaksi atomik menjaga payment/order/job selalu konsisten; `jobId` deterministik mencegah job ganda di BullMQ.

Hasil akhirnya: **exactly-once processing**, pembayaran dicatat sekali, order naik status sekali, fulfillment dijalankan sekali, betapa pun banyaknya provider mengirim ulang pesan yang sama.

Files dibaca (semua akurat ke kode nyata): `D:\manifest\apps\api\src\rest\webhook.ts`, `D:\manifest\apps\api\src\services\webhook-service.ts`, `D:\manifest\apps\api\src\env.ts`, `D:\manifest\packages\shared\src\schemas.ts`.

## 4. Worker & fulfillment retry-safe (apps/worker)

Bagian ini menjelaskan otak dari **Flow 3** (proses pemenuhan pesanan / _fulfillment_). Setelah order dibayar (`PAID`), sistem tidak langsung mengurangi stok dan membuat invoice di tengah request HTTP, karena itu lambat dan rapuh. Sebaliknya, sebuah pesan ditaruh di **antrian (queue)**, lalu sebuah program terpisah yang disebut **worker** mengambil pesan itu dan mengerjakannya di latar belakang.

Istilah penting dulu:

- **Queue (antrian)**: daftar pekerjaan (_job_) yang menunggu dikerjakan, mirip antrian di kasir.
- **Worker**: program yang berdiri sendiri, terus-menerus mengambil job dari antrian dan menjalankannya. Di sini namanya `apps/worker`.
- **BullMQ**: library Node.js yang mengelola antrian itu, dengan penyimpanan datanya di **Redis** (database super cepat di memori).
- **Idempotent**: sebuah operasi yang aman dijalankan berkali-kali dan hasilnya sama seperti dijalankan sekali. Ini konsep inti seluruh bab ini.

---

### 4.1 Menghubungkan worker ke Redis

```ts
import { UnrecoverableError, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
```

- `IORedis` adalah klien (penghubung) ke server Redis. `env.REDIS_URL` adalah alamatnya (mis. `redis://localhost:6379`).
- `maxRetriesPerRequest: null` artinya: jangan batasi berapa kali IORedis mencoba ulang satu perintah ke Redis. Ini bukan opsional, karena BullMQ secara teknis mewajibkan setelan ini untuk worker, sebab worker memakai koneksi jangka panjang yang menunggu (_blocking_) job baru. Tanpa ini BullMQ akan menolak jalan.

**Kenapa begini:** worker dan Redis adalah dua proses berbeda. `connection` adalah jembatannya. Satu `connection` ini nanti dipakai ulang oleh worker maupun saat shutdown.

---

### 4.2 Membuat Worker: connection, concurrency, dan handler

```ts
const worker = new Worker<FulfillmentJobData>(
  FULFILLMENT_QUEUE_NAME,
  async (job) => {
    /* ...processor... */
  },
  { connection, concurrency: 5 },
);
```

Tiga argumen `new Worker(...)`:

1. **`FULFILLMENT_QUEUE_NAME`**, yaitu nama antrian yang dipantau. Nama ini di-_share_ lewat paket `@manifest/shared`, jadi sisi yang menaruh job (API/producer) dan sisi yang mengambil job (worker/consumer) pasti pakai nama yang sama persis. Kalau beda satu huruf, job tidak akan pernah ketemu.
2. **Processor function** (`async (job) => {...}`), yaitu fungsi yang dipanggil untuk setiap job. `job.data` berisi payload-nya (di sini `FulfillmentJobData` = `{ orderId, correlationId }`). Tipe generic `<FulfillmentJobData>` membuat TypeScript tahu bentuk `job.data`.
3. **Options**, yaitu `{ connection, concurrency: 5 }`.

`concurrency: 5` artinya worker boleh mengerjakan **5 job sekaligus** secara paralel. Bukan satu-satu. Kalau ada 100 order menumpuk, lima diproses bersamaan sehingga antrian cepat habis.

**Kenapa begini:** concurrency menaikkan throughput, tapi langsung memunculkan bahaya: dua job untuk order yang sama (atau satu job yang di-retry sementara percobaan lama belum benar-benar selesai) bisa berjalan berdekatan. Inilah alasan seluruh logika fulfillment harus _idempotent_; kita tidak boleh mengandalkan "pasti cuma jalan sekali".

---

### 4.3 Apa yang dilakukan processor: bookkeeping + terjemahan error

Mari pecah isi processor.

**(a) Tandai job sedang diproses + hitung attempt**

```ts
if (job.id) {
  await prisma.fulfillmentJob.updateMany({
    where: { bullJobId: job.id },
    data: { status: FulfillmentJobStatus.PROCESSING, attempts: job.attemptsMade + 1 },
  });
}
```

- Ada dua catatan terpisah: state internal BullMQ (di Redis) dan baris **`FulfillmentJob`** di database kita sendiri (Postgres). Baris DB inilah yang nanti ditampilkan di dashboard agar user bisa lihat status dan tombol Retry.
- `bullJobId: job.id` menghubungkan keduanya. Kita update baris DB menjadi `PROCESSING`.
- `attempts: job.attemptsMade + 1`, karena `attemptsMade` dari BullMQ dihitung mulai 0, jadi kita `+1` supaya tampil ke manusia sebagai "percobaan ke-1, ke-2, ...".

**(b) Jalankan logika domain + terjemahkan error**

```ts
try {
  await runFulfillment(job.data);
} catch (error) {
  if (error instanceof PermanentFulfillmentError) {
    throw new UnrecoverableError(error.message); // BullMQ: STOP, jangan retry
  }
  throw error; // BullMQ: retry dengan backoff
}
```

Ini adalah inti pengambilan keputusan retry, dan layak dipahami benar-benar:

- `runFulfillment(job.data)` melakukan kerja sebenarnya (dibahas di 4.4).
- Kalau gagal, kita lihat jenis error-nya:
  - **`PermanentFulfillmentError`** = kegagalan yang _tidak akan pernah berhasil_ walau diulang. Contoh: order tidak ditemukan, atau stok memang kurang. Mengulanginya sia-sia. Kita bungkus jadi `UnrecoverableError`, kata kunci khusus BullMQ yang berarti "berhenti, jangan retry lagi".
  - **Error biasa** (mis. database sempat putus, Redis hiccup) = kegagalan **sementara (transient)**. Ini _bisa_ berhasil kalau dicoba lagi. Kita `throw error` apa adanya, dan BullMQ akan retry otomatis.

**Kenapa begini:** membedakan "permanen vs sementara" adalah keputusan paling penting di sistem antrian. Kalau semua error di-retry, error permanen akan diulang sampai habis percobaan dan membuang sumber daya. Kalau semua error dianggap permanen, gangguan sekejap (yang seharusnya sembuh sendiri) malah membuat order gagal selamanya. Polanya: logika domain hanya tahu konsep "permanen" lewat `PermanentFulfillmentError`, dan lapisan worker lah yang menerjemahkannya ke bahasa BullMQ (`UnrecoverableError`). Domain tidak perlu kenal BullMQ, sebuah pemisahan tanggung jawab yang bersih.

**(c) Tandai selesai**

```ts
if (job.id) {
  await prisma.fulfillmentJob.updateMany({
    where: { bullJobId: job.id },
    data: { status: FulfillmentJobStatus.COMPLETED },
  });
}
```

Kalau processor sampai baris ini tanpa melempar error, berarti sukses. Baris `FulfillmentJob` di DB jadi `COMPLETED`.

---

### 4.4 attempts / backoff: dari mana datangnya?

Perlu dicatat: jumlah maksimal percobaan dan **backoff** (jeda yang makin lama antar retry) tidak diset di `new Worker(...)`. Setelan itu menempel pada **job** saat di-_add_ ke antrian oleh sisi producer (API). Worker hanya membaca hasilnya lewat `job.opts.attempts`:

```ts
const maxAttempts = job.opts.attempts ?? 1;
```

- `job.opts.attempts` = berapa kali job ini boleh dicoba (mis. 3). `?? 1` = kalau tidak diset, anggap sekali.
- **Backoff** (mis. _exponential backoff_: tunggu 1 detik, lalu 2 detik, lalu 4 detik) juga diset di sisi producer dan dijalankan otomatis oleh BullMQ. Worker tidak mengatur jedanya, ia hanya dipanggil ulang ketika waktunya tiba.

**Kenapa begini:** "kebijakan retry" adalah properti dari _pekerjaan itu_, bukan dari mesin yang mengerjakannya. Jadi wajar diset di tempat job dibuat. Worker tetap netral dan bisa melayani job dengan kebijakan retry berbeda-beda.

---

### 4.5 Handler `completed` dan `failed`

BullMQ memancarkan **event** setelah sebuah job selesai. Kita "mendengarkan" dengan `worker.on(...)`.

Sukses, cukup log:

```ts
worker.on('completed', (job) => {
  logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Fulfillment job completed');
});
```

Gagal, tentukan apakah ini kegagalan FINAL:

```ts
worker.on('failed', async (job, error) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  const isFinal = error.name === 'UnrecoverableError' || job.attemptsMade >= maxAttempts;
  ...
});
```

- Handler ini terpicu setiap kali satu percobaan gagal, termasuk percobaan yang masih akan di-retry.
- `isFinal` benar jika salah satu: errornya `UnrecoverableError` (permanen, sudah pasti berhenti), atau semua jatah percobaan habis (`attemptsMade >= maxAttempts`).

Lalu state ditulis sesuai `isFinal`:

```ts
data: {
  status: isFinal ? FulfillmentJobStatus.FAILED : FulfillmentJobStatus.QUEUED,
  lastError: error.message,
  attempts: job.attemptsMade,
},
```

- Kalau belum final: status `FulfillmentJob` dikembalikan ke `QUEUED`, di dashboard terlihat "menunggu dicoba lagi". `lastError` disimpan supaya alasan kegagalan terbaru tetap terlihat.
- Kalau final: status `FAILED`.

Dan hanya saat final, order-nya ditandai gagal:

```ts
if (isFinal && job.data) {
  await markOrderFailed(job.data.orderId, job.data.correlationId, error.message);
}
```

**Kenapa begini:** kita tidak mau menandai order `FAILED` hanya karena percobaan pertama gagal, sebab mungkin retry berikutnya berhasil. Order baru dinyatakan gagal setelah benar-benar tidak ada harapan lagi (permanen, atau jatah retry habis). Ini menjaga lifecycle order tetap jujur.

---

### 4.6 Graceful shutdown

```ts
async function shutdown(signal: string): Promise<void> {
  await worker.close(); // selesaikan job yang sedang jalan, stop ambil yang baru
  await connection.quit(); // tutup koneksi Redis dengan rapi
  await prisma.$disconnect(); // tutup koneksi database
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

- `SIGINT`/`SIGTERM` adalah sinyal "tolong mati" dari OS (mis. Ctrl+C, atau saat container di-stop).
- `worker.close()` menunggu job yang sedang diproses selesai dulu, baru benar-benar berhenti, tidak memotong pekerjaan di tengah jalan.

**Kenapa begini:** mematikan worker mendadak saat sebuah `$transaction` setengah jalan bisa meninggalkan data tak konsisten. Shutdown yang rapi memberi job kesempatan menuntaskan diri. Ini juga lapis pertahanan untuk retry-safety: minim peluang berhenti di tengah.

---

### 4.7 `runFulfillment` langkah demi langkah (jantung retry-safety)

Komentar di kode menyatakan tujuannya gamblang: fungsi ini didesain aman dijalankan lebih dari sekali untuk order yang sama. Setiap efek samping mengecek dulu "apakah ini sudah pernah terjadi?". Mari telusuri.

**(a) Validasi input + ambil order**

```ts
const { orderId, correlationId } = fulfillmentJobDataSchema.parse(rawData);
const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
if (!order) {
  throw new PermanentFulfillmentError(`Order not found: ${orderId}`);
}
```

- `fulfillmentJobDataSchema.parse(...)` memvalidasi payload (pakai Zod). Kalau bentuknya salah, langsung error, jangan percaya data antrian buta-buta.
- Order tidak ada berarti permanen. Retry tidak akan memunculkan order yang sudah tidak ada.

**(b) Putuskan tindakan dari status sekarang, `decideFulfillment`**

```ts
let action;
try {
  action = decideFulfillment(order.status as OrderStatus);
} catch (error) {
  throw new PermanentFulfillmentError((error as Error).message);
}

if (action.kind === 'noop') {
  log.info({ orderId }, 'Order already fulfilled, no-op');
  return;
}
```

- `decideFulfillment` adalah fungsi domain murni yang melihat status saat ini dan mengembalikan rencana:
  - **`start`**: order masih `PAID` (atau `FAILED` yang di-retry), perlu pindah ke `FULFILLING`.
  - **`continue`**: order sudah `FULFILLING`, lanjutkan dari tengah (percobaan sebelumnya berhenti di tengah jalan).
  - **`noop`**: order sudah `FULFILLED`, tidak ada yang perlu dikerjakan, langsung `return`.
- Status yang tidak boleh difulfill (mis. masih `PENDING`) membuat `decideFulfillment` melempar error, dan kita anggap permanen.

**Kenapa begini, ini kunci idempotency:** kalau job yang sama tak sengaja jalan dua kali, percobaan kedua melihat order sudah `FULFILLED` lalu langsung `noop`. Tidak ada stok dikurangi lagi, tidak ada invoice kedua. Status order menjadi penjaga utama yang mencegah pekerjaan ganda.

**(c) Transisi status lewat state machine, `assertTransition`**

```ts
if (action.kind === 'start') {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: assertTransition(order.status as OrderStatus, OrderStatus.FULFILLING) },
  });
}
```

- `assertTransition(dari, ke)` memeriksa apakah perpindahan status itu diizinkan oleh aturan lifecycle (PENDING lalu PAID lalu FULFILLING lalu FULFILLED), lalu mengembalikan status tujuan jika sah.
- Perhatikan: untuk `action.kind === 'continue'` (sudah `FULFILLING`) blok ini dilewati, tidak perlu transisi lagi.

**Kenapa begini:** kita tidak pernah menulis status secara langsung tanpa pengecekan. State machine menjamin order tidak bisa "melompat" ke status ilegal, sekalipun ada job nyasar atau kondisi balapan (_race_).

**(d) Reservasi inventory di dalam `$transaction`, dengan guard "sudah direservasi? lewati"**

```ts
await prisma.$transaction(async (tx) => {
  const existing = await tx.inventoryReservation.findMany({
    where: { orderId },
    select: { sku: true },
  });
  const reservedSkus = new Set(existing.map((r) => r.sku));

  for (const item of order.items) {
    if (reservedSkus.has(item.sku)) continue; // sudah direservasi -> lewati

    const inv = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
    if (!inv) throw new InsufficientStockError(item.sku, item.quantity, 0);

    const newStock = reserveStock(item.sku, inv.stock, item.quantity);
    await tx.inventoryItem.update({ where: { sku: item.sku }, data: { stock: newStock } });
    await tx.inventoryReservation.create({
      data: { orderId, sku: item.sku, quantity: item.quantity },
    });
  }
});
```

Ini bagian paling rawan, dan paling cermat dirancang. Pecah per bagian:

- **`$transaction`** = beberapa operasi DB dibungkus jadi satu kesatuan **all-or-nothing**. Kalau salah satu langkah di dalam gagal, semua dibatalkan (_rollback_) seolah tak pernah terjadi. Variabel `tx` adalah handle khusus di dalam transaksi, semua query harus pakai `tx`, bukan `prisma`, agar ikut dalam transaksi yang sama.
- **Baca dulu apa yang sudah direservasi:** ambil semua `inventoryReservation` milik order ini, kumpulkan SKU-nya ke dalam `Set` (`reservedSkus`) supaya pengecekan cepat.
- **Loop tiap item:**
  - `if (reservedSkus.has(item.sku)) continue;` inilah guard "already reserved? skip". Kalau percobaan sebelumnya sudah sempat mereservasi SKU ini, percobaan sekarang melewatinya. Tanpa ini, retry akan mengurangi stok dua kali.
  - SKU tidak ada di inventory akan memunculkan `InsufficientStockError` (nanti diperlakukan permanen).
  - `reserveStock(...)` adalah aturan domain murni yang menghitung stok baru dan menolak jika stok jatuh di bawah nol, jadi stok tidak akan pernah negatif.
  - Kurangi stok dan catat satu baris `inventoryReservation`. Dua operasi ini terjadi dalam transaksi yang sama, jadi mustahil "stok berkurang tapi reservasi tidak tercatat" (atau sebaliknya).

**Kenapa begini, dua lapis keamanan bekerja bersama:**

1. **Atomicity** (`$transaction`): pengurangan stok dan pencatatan reservasi selalu konsisten, keduanya jadi, atau keduanya batal.
2. **Idempotency** (guard `reservedSkus` + tabel reservasi): tabel `inventoryReservation` berfungsi sebagai catatan permanen "SKU ini untuk order ini sudah pernah saya kurangi". Catatan inilah yang membuat efek samping (mengurangi stok) aman diulang. Inilah pola umum membuat _side effect_ (efek yang mengubah dunia luar) menjadi idempotent: simpan bukti bahwa efek itu sudah dijalankan, lalu cek bukti itu sebelum menjalankannya lagi.

**(e) Penanganan error reservasi, permanen vs sementara**

```ts
} catch (error) {
  if (error instanceof InsufficientStockError) {
    await markOrderFailed(orderId, correlationId, error.message);
    throw new PermanentFulfillmentError(error.message);
  }
  throw error; // transient (mis. DB blip) -> biarkan BullMQ retry
}
```

- **Stok kurang** = permanen (retry tidak akan menambah stok dengan sendirinya): tandai order `FAILED`, lalu lempar `PermanentFulfillmentError` agar worker membungkusnya jadi `UnrecoverableError`.
- **Error lain** (mis. DB sempat putus) = sementara: lempar apa adanya supaya BullMQ retry. Karena reservasi tadi ada di dalam `$transaction`, jika gagal di tengah, perubahan stok sudah otomatis di-_rollback_, dan retry mulai dari kondisi bersih.

**(f) Buat invoice, hanya sekali per order ("create once")**

```ts
const existingInvoice = await prisma.invoice.findUnique({ where: { orderId } });
if (shouldCreateInvoice(existingInvoice?.id)) {
  const invoiceNumber = buildInvoiceNumber(orderId, new Date());
  await prisma.invoice.create({
    data: { orderId, invoiceNumber, amount: order.totalAmount, status: InvoiceStatus.ISSUED },
  });
  ...
}
```

- Cek dulu: apakah order ini sudah punya invoice? `shouldCreateInvoice(existingInvoice?.id)` mengembalikan `true` hanya jika belum ada (`?.` = _optional chaining_: kalau `existingInvoice` `null`, hasilnya `undefined`, bukan error).
- Membuat invoice juga sangat terbantu oleh **constraint database**: kolom `orderId` di tabel `Invoice` bersifat unik (terbukti dari `findUnique({ where: { orderId } })`). Jadi seandainya dua percobaan lolos pengecekan secara bersamaan, database tetap menolak invoice kedua.

**Kenapa begini:** invoice adalah dokumen keuangan, dan menerbitkannya dua kali untuk satu order adalah bug serius (pelanggan ditagih dua kali). Pengecekan "sudah ada?" plus constraint unik memberi jaminan "create once" yang berlapis: satu lapis di logika aplikasi, satu lapis di database sebagai pengaman terakhir.

**(g) Finalisasi menuju FULFILLED**

```ts
await prisma.order.update({
  where: { id: orderId },
  data: { status: assertTransition(OrderStatus.FULFILLING, OrderStatus.FULFILLED) },
});
await writeEvent(prisma, { orderId, type: OrderEventType.ORDER_FULFILLED, correlationId });
```

- Transisi terakhir lifecycle: `FULFILLING` lalu `FULFILLED`, lagi-lagi lewat `assertTransition` agar tetap sesuai aturan.
- Setiap langkah penting (`FULFILLMENT_STARTED`, `INVENTORY_RESERVED`, `INVOICE_GENERATED`, `ORDER_FULFILLED`) juga ditulis sebagai **event** lewat `writeEvent`. Ini membentuk _audit trail_, riwayat lengkap apa yang terjadi pada order, yang ditampilkan di timeline dashboard.

---

### 4.8 Jalur GAGAL / rollback, `markOrderFailed`

```ts
export async function markOrderFailed(orderId, correlationId, message): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.FAILED) return; // sudah FAILED -> diam

  if (order.status === OrderStatus.FULFILLING) {
    await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.FAILED } });
  }

  await writeEvent(prisma, {
    orderId,
    type: OrderEventType.ORDER_FAILED,
    correlationId,
    payload: { message },
  });
}
```

- `if (!order || order.status === OrderStatus.FAILED) return;` adalah guard idempotency lagi. Kalau order sudah `FAILED`, fungsi langsung berhenti, tidak menulis event `order.failed` kedua. Jadi memanggil `markOrderFailed` berulang kali aman: hanya event gagal pertama yang tercatat.
- Transisi ke `FAILED` hanya dilakukan jika order sedang `FULFILLING`, sesuai aturan lifecycle.

Catatan soal "rollback": kegagalan permanen (mis. stok kurang) terjadi sebelum invoice/finalisasi. Perubahan stok yang setengah jalan sudah di-_rollback_ oleh `$transaction`. Reservasi yang berhasil sengaja tidak dibatalkan otomatis, itu menjadi tugas operasi manual (mis. tombol di dashboard), karena membatalkan reservasi adalah keputusan bisnis, bukan kecelakaan teknis.

---

### 4.9 Ringkasan: kenapa seluruh rancangan ini "retry-safe"

Sistem antrian harus berasumsi job bisa jalan lebih dari sekali (retry otomatis, klik tombol Retry manual, atau dua percobaan tumpang tindih karena `concurrency: 5`). Manifest menjawab dengan disiplin berlapis:

- **Status order sebagai penjaga gerbang**, yaitu `decideFulfillment` membuat percobaan kedua jadi `noop` jika sudah `FULFILLED`.
- **Bukti tersimpan untuk tiap efek samping**, yaitu tabel `inventoryReservation` (per-SKU) dan keberadaan `Invoice` (per-order) dicek sebelum aksi, jadi stok tak pernah dikurangi dua kali dan invoice tak pernah dibuat dua kali.
- **Atomicity lewat `$transaction`**, yaitu pengurangan stok dan pencatatan reservasi selalu konsisten; gagal di tengah berarti rollback bersih.
- **Constraint unik database**, sebagai pengaman terakhir jika logika aplikasi kebobolan saat balapan.
- **Permanen vs sementara dibedakan tegas**, yaitu `PermanentFulfillmentError`/`UnrecoverableError` menghentikan retry sia-sia, sementara error biasa membiarkan BullMQ mencoba lagi dengan backoff.
- **Order baru `FAILED` saat benar-benar final**, bukan karena satu percobaan gagal.

Hasilnya: berapa kali pun job dijalankan, dunia berakhir di kondisi yang benar persis seolah dijalankan tepat satu kali. Itulah definisi **idempotent**, dan itulah yang membuat pipeline PENDING lalu PAID lalu FULFILLING lalu FULFILLED ini bisa dipercaya.

## 5. Autentikasi: session, hashing, middleware (apps/api + apps/web)

Bagian ini menjelaskan bagaimana Manifest tahu "siapa kamu" dan "apakah kamu boleh masuk". Autentikasi (authentication, sering disingkat **auth**) adalah proses memastikan identitas pengguna. Di proyek ini auth memakai pendekatan cookie-session berbasis database, bukan JWT. Kita akan bedah satu per satu: cara menyimpan password dengan aman (hashing), cara membuat "tiket masuk" (session token), cara tiket itu dibawa di cookie, cara login dibuat aman dari serangan, lalu cara frontend (Next.js) ikut menjaga semuanya.

Kaitan dengan gambaran besar: semua data order (PENDING lalu PAID lalu FULFILLING lalu FULFILLED) hanya boleh dilihat dan diubah oleh user yang sudah login. Jadi auth adalah "pintu gerbang" sebelum siapa pun bisa menyentuh lifecycle order.

---

### 5.1 Menyimpan password dengan benar: bcrypt hashing

Kita TIDAK PERNAH menyimpan password asli di database. Kalau database bocor, semua password ketahuan. Solusinya adalah **hashing**, yaitu mengubah password jadi string acak satu arah yang tidak bisa dibalik. Library yang dipakai adalah **bcrypt** (lewat paket `bcryptjs`).

```ts
const BCRYPT_COST = 12;
// ...
const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
const user = await prisma.user.create({ data: { email, passwordHash } });
```

Penjelasan per baris:

- `BCRYPT_COST = 12` adalah **cost factor** (faktor biaya). Angka 12 berarti bcrypt mengulang proses hashing `2^12` (4096) kali. Makin tinggi, makin lambat dihitung, dan itu memang tujuannya: bikin penyerang yang mau menebak jutaan password jadi sangat lambat. 12 adalah angka standar yang aman tahun-tahun ini.
- `await bcrypt.hash(input.password, BCRYPT_COST)` mengubah password polos jadi hash. Output-nya string seperti `$2a$12$...` yang sudah memuat **salt** (garam acak) di dalamnya. Salt adalah data acak yang dicampur ke tiap password sebelum di-hash, supaya dua orang dengan password sama tetap menghasilkan hash berbeda. Ini mematahkan serangan "rainbow table" (tabel hash yang sudah dihitung sebelumnya).
- `passwordHash` yang disimpan ke kolom `passwordHash`, bukan password aslinya.

Saat login, kita tidak "membalik" hash (memang tidak bisa). Kita hash ulang input dan bandingkan:

```ts
const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
```

`bcrypt.compare` mengambil password yang baru diketik, mengambil salt dari hash tersimpan, meng-hash ulang, lalu membandingkan hasilnya. Kalau cocok, hasilnya `true`.

Kenapa begini: hashing satu arah berarti meski DB bocor, password asli tidak terungkap. Cost factor membuat brute-force mahal. Salt otomatis membuat tiap hash unik. Ini standar industri untuk menyimpan password.

---

### 5.2 Login yang aman: konstan waktu dan tidak membocorkan akun

Ada serangan halus bernama **user enumeration** (penghitungan akun): penyerang mencoba banyak email, lalu menebak email mana yang terdaftar dari perbedaan respons, entah dari pesan error atau dari waktu respons. Kalau email tidak ada, server biasanya langsung menolak (cepat); kalau email ada, server sempat mengecek password (lambat). Selisih waktu itu membocorkan keberadaan akun.

Kode ini menutup celah tersebut:

```ts
// A fixed hash to compare against when the email is unknown, so login response
// time does not reveal whether an account exists (anti-enumeration / timing).
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_COST);
// ...
const user = await prisma.user.findUnique({ where: { email } });
// Always run a compare (dummy hash when the user is missing) so timing is
// constant regardless of whether the email exists.
const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !ok) {
  throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
}
```

Penjelasan blok:

- `DUMMY_HASH` adalah sebuah hash palsu yang dibuat sekali saat server start. Gunanya: kalau email tidak ditemukan, kita tetap menjalankan `bcrypt.compare` melawan hash dummy ini. Jadi waktu pemrosesan untuk "email tidak ada" mirip dengan "email ada tapi password salah".
- `user?.passwordHash ?? DUMMY_HASH`: tanda `?.` (optional chaining) artinya "ambil `passwordHash` kalau `user` ada". Tanda `??` (nullish coalescing) artinya "kalau hasilnya null/undefined, pakai `DUMMY_HASH`". Jadi kita SELALU punya sesuatu untuk dibandingkan, `compare` selalu jalan.
- `if (!user || !ok)`: apa pun penyebab gagal (email tak ada ATAU password salah), error yang dilempar sama persis, yaitu `INVALID_CREDENTIALS` dengan pesan generik `'Invalid email or password'`.

Catatan istilah: "konstan waktu" (constant-time) di sini bukan jaminan matematis sempurna, tapi praktis, kita menyamakan beban kerja agar selisih waktu tidak informatif.

Kenapa begini: dengan menyamakan waktu DAN pesan error, penyerang tidak bisa membedakan "email salah" dari "password salah". Mereka tidak bisa memetakan email mana yang terdaftar. Ini pertahanan murah tapi penting.

---

### 5.3 Session token: tiket masuk acak yang disimpan di DB

Setelah login sukses, server membuat **session**, yaitu catatan di database bahwa "token X = user Y, berlaku sampai tanggal Z". Token-nya bersifat **opaque** (buram): hanya string acak tanpa makna, bukan data terenkripsi.

```ts
async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex'); // 256-bit opaque token
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return token;
}
```

Penjelasan per baris:

- `randomBytes(32)` menghasilkan 32 byte acak kriptografis (dari modul `node:crypto`). 32 byte sama dengan 256 bit. `.toString('hex')` mengubahnya jadi teks heksadesimal (64 karakter). 256 bit acak praktis mustahil ditebak.
- `expiresAt = new Date(Date.now() + SESSION_TTL_MS)`: `SESSION_TTL_MS` adalah `7 * 24 * 60 * 60 * 1000` (7 hari). TTL adalah Time To Live (masa berlaku). Jadi token kedaluwarsa 7 hari ke depan.
- `prisma.session.create({ data: { id: token, userId, expiresAt } })` menyimpan baris baru di tabel `Session`: `id` adalah token itu sendiri, `userId` adalah pemiliknya, plus waktu kedaluwarsa.

Saat ada request masuk membawa token, kita validasi balik ke DB:

```ts
const session = await prisma.session.findUnique({
  where: { id: token },
  include: { user: true },
});
if (!session) return null;
if (session.expiresAt.getTime() <= Date.now()) {
  await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
  return null;
}
return toPublic(session.user);
```

- Cari session berdasarkan token. Tidak ketemu, hasilnya `null` (tidak login).
- Kalau `expiresAt` sudah lewat, hapus barisnya (bersih-bersih) dan anggap tidak login. `.catch(() => undefined)` artinya kalau penghapusan gagal pun, abaikan saja, jangan crash.
- Kalau valid, kembalikan data user publik (`id` dan `email` saja, lewat `toPublic`, supaya `passwordHash` tidak pernah bocor keluar).

Logout cukup hapus barisnya:

```ts
export async function logout(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: token } });
}
```

Kenapa begini: karena session ada di DB, server bisa **mencabut** (revoke) akses kapan saja, cukup hapus barisnya, token langsung mati. Ini tidak bisa dilakukan dengan JWT murni (lihat 5.7). Token opaque juga tidak membocorkan info apa pun kalau bocor sebagian.

---

### 5.4 Cookie httpOnly yang ditandatangani

Token tadi dikirim ke browser sebagai **cookie**, sepotong data yang browser simpan dan kirim otomatis di setiap request ke server yang sama. Cookie-nya bernama `sid` (session id) dan diatur dengan opsi keamanan ketat:

```ts
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
  signed: true,
  maxAge: SESSION_TTL_SECONDS,
};
```

Penjelasan tiap opsi:

- `httpOnly: true`: cookie ini tidak bisa dibaca oleh JavaScript di browser (`document.cookie`). Ini melindungi dari serangan XSS (Cross-Site Scripting): meski penyerang menyuntik script jahat, mereka tidak bisa mencuri token.
- `sameSite: 'lax'`: cookie hanya ikut terkirim pada navigasi normal dari situs sendiri, bukan pada request lintas-situs yang mencurigakan. Ini pertahanan terhadap CSRF (Cross-Site Request Forgery), serangan di mana situs lain memicu request atas nama kamu.
- `secure: env.NODE_ENV === 'production'`: di production, cookie hanya dikirim lewat HTTPS (koneksi terenkripsi). Saat development (HTTP lokal) dimatikan agar tetap jalan.
- `path: '/'`: cookie berlaku untuk seluruh situs.
- `signed: true`: cookie **ditandatangani** dengan secret server. Server menambahkan tanda tangan kriptografis; saat cookie kembali, server memverifikasi tanda tangan itu. Kalau ada yang mengutak-atik isi cookie, tanda tangan tidak cocok dan cookie ditolak.
- `maxAge: SESSION_TTL_SECONDS`: umur cookie di browser (7 hari, dalam detik), selaras dengan TTL session di DB.

Membaca cookie kembali dengan verifikasi tanda tangan:

```ts
export function readSessionToken(req: FastifyRequest): string | null {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}
```

- Ambil cookie mentah `sid`. Tidak ada, hasilnya `null`.
- `req.unsignCookie(raw)` memeriksa tanda tangannya. Kembaliannya punya `.valid` (apakah tanda tangan sah) dan `.value` (token aslinya).
- Hanya kembalikan token kalau `valid === true`. Cookie yang dipalsukan ditolak di sini.

Kenapa begini: kombinasi `httpOnly`, `signed`, `sameSite`, dan `secure` menutup tiga kelas serangan sekaligus (XSS mencuri token, pemalsuan isi cookie, dan CSRF). Token disimpan di tempat yang JavaScript tak bisa sentuh, jauh lebih aman daripada menaruh token di `localStorage`.

---

### 5.5 Penjaga /graphql: requireAuth preHandler

Semua data order diakses lewat endpoint `/graphql`. Sebelum query GraphQL apa pun jalan, ada **preHandler** (fungsi penjaga yang berjalan sebelum handler utama) yang memastikan request membawa session valid:

```ts
preHandler: async (req, reply) => {
  if (req.method === 'OPTIONS') return;
  if (isDev && req.method === 'GET') return;
  const user = await getUserBySessionToken(readSessionToken(req));
  if (!user) {
    return reply.status(401).send({ errors: [{ message: 'Unauthorized' }] });
  }
},
```

Penjelasan baris demi baris:

- `if (req.method === 'OPTIONS') return;`: request `OPTIONS` adalah "preflight" CORS yang dikirim browser otomatis untuk menanyakan izin; tidak membawa data, jadi dilewatkan.
- `if (isDev && req.method === 'GET') return;`: hanya saat development, request `GET` ke `/graphql` dibiarkan lewat supaya halaman GraphiQL (penjelajah query interaktif untuk developer) bisa dimuat. Di production ini tidak berlaku.
- `getUserBySessionToken(readSessionToken(req))`: baca token dari cookie bertanda tangan, lalu validasi ke DB (fungsi yang sama dari 5.3).
- Kalau tidak ada user valid, balas `401 Unauthorized` dan hentikan request. Handler GraphQL tidak akan pernah jalan.

Kenapa begini: ini adalah penegakan auth yang SEBENARNYA. Semua akses ke lifecycle order (lihat dashboard, daftar order, ubah status) harus lewat `/graphql`, jadi satu penjaga di sini melindungi seluruh data. Tidak peduli apa yang dilakukan frontend, tanpa session valid, API menolak.

---

### 5.6 Gerbang UX di Next.js: middleware

Di sisi frontend, ada `middleware.ts`, kode yang Next.js jalankan untuk setiap request SEBELUM halaman dirender. Tapi perhatikan: ini hanya gerbang UX (pengalaman pengguna), bukan keamanan sungguhan.

```ts
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('sid');
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
```

Penjelasan:

- `req.cookies.has('sid')`: hanya cek keberadaan cookie `sid`, TIDAK memvalidasinya. Komentar di file ini eksplisit: "a forged cookie passes here but is rejected there" (cookie palsu lolos di sini tapi ditolak di API).
- `isAuthPage`: apakah halaman tujuan adalah `/login` atau `/register`.
- `if (!hasSession && !isAuthPage)`: tidak punya cookie DAN bukan halaman auth, maka tendang ke `/login`. Tujuannya: pengguna belum login tidak melihat dashboard kosong yang error, langsung diarahkan ke login.
- Perhatikan: kode TIDAK menendang pengguna yang punya cookie keluar dari `/login`. Komentar menjelaskan alasannya: cookie yang ada-tapi-tak-valid (misalnya setelah session dicabut atau DB di-reset) tetap harus bisa mengakses `/login` untuk login ulang.

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
```

- `matcher` membatasi di mana middleware jalan: semua rute KECUALI file internal Next (`_next/static`, `_next/image`) dan aset statis (`favicon.ico`, `icon.svg`). Ini agar middleware tidak membebani pemuatan gambar/CSS.

Kenapa begini: middleware ini sekadar mempercepat pengalaman, mengarahkan pengguna ke tempat yang benar tanpa harus menunggu API menolak. Keamanan sesungguhnya tetap di API (5.5). Pembagian peran ini penting: jangan pernah mengandalkan cek frontend sebagai satu-satunya perlindungan.

---

### 5.7 Server Component meneruskan cookie via next/headers

Halaman dashboard dirender di server sebagai **Server Component** (komponen React yang dijalankan di server, bukan di browser). Masalahnya: saat Server Component memanggil API, request itu tidak otomatis membawa cookie browser. Jadi kita harus membacanya manual dan meneruskannya.

```ts
import { cookies } from 'next/headers';
// A Server Component's fetch does not automatically carry the browser's cookies,
// so we read them via next/headers and forward the session cookie to the API.
async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}
```

- `cookies()` dari `next/headers` adalah cara resmi Next.js membaca cookie request yang masuk di sisi server.
- `store.toString()` mengubah semua cookie jadi satu string format header (`sid=...; lain=...`), siap dipasang sebagai header `Cookie`.

Lalu setiap fetch data menyertakannya:

```ts
export async function fetchOrders(status?: OrderStatus): Promise<Order[]> {
  const data = await graphqlRequest<{ orders: Order[] }>(
    ORDERS_QUERY,
    { status },
    await cookieHeader(), // <- cookie diteruskan ke API
  );
  return data.orders;
}
```

Dan untuk mengambil user yang sedang login (`fetchMe`):

```ts
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: await cookieHeader() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { user: AuthUser | null };
    return json.user;
  } catch {
    return null;
  }
}
```

- `headers: { Cookie: await cookieHeader() }` secara manual memasang cookie sesi ke request server-ke-server, sehingga endpoint `/auth/me` di API bisa mengenali user (lagi-lagi memakai `getUserBySessionToken`).
- `cache: 'no-store'`: jangan cache hasilnya; identitas user harus selalu segar, tidak boleh memakai data lama.
- `try/catch` mengembalikan `null` (tidak pernah melempar error) saat tidak login atau API mati, sehingga "cangkang" layout tetap bisa dirender. Komentar di file menegaskan ini: "Returns null (never throws)... so the shell renders regardless."

Kenapa begini: di arsitektur Next.js App Router, render terjadi di server, jadi cookie browser harus diteruskan eksplisit agar API tahu siapa pemanggilnya. Tanpa langkah ini, setiap fetch dari Server Component akan dianggap "tidak login" oleh penjaga `/graphql`.

---

### 5.8 Kenapa cookie-session, bukan JWT?

Ini keputusan arsitektur penting yang harus bisa kamu jelaskan saat wawancara.

**JWT (JSON Web Token)** adalah token yang isinya data user terenkode dan ditandatangani; server cukup verifikasi tanda tangan tanpa cek DB ("stateless"). Kedengarannya efisien, tapi punya kelemahan:

- **Susah dicabut.** Karena server tidak menyimpan state, JWT yang sudah dikeluarkan tetap valid sampai kedaluwarsa. Mau logout paksa atau blokir user yang dibajak? Tidak bisa instan tanpa membangun daftar blokir (blacklist), yang justru membuatnya butuh DB lagi, menghilangkan keuntungan "stateless".
- **Isi token terekspos.** Payload JWT cuma di-encode (base64), bisa dibaca siapa saja yang memegangnya. Tidak cocok menaruh data sensitif.
- **Ukuran lebih besar** dan rotasi secret lebih ribet.

Pendekatan proyek ini (opaque token plus session di DB) memberi:

- **Pencabutan instan (revocation).** Hapus baris session, maka token mati saat itu juga (lihat `logout` dan penghapusan saat kedaluwarsa di 5.3). Sangat penting untuk dashboard fulfillment yang mengelola order bernilai uang.
- **Token tanpa makna.** Bocor pun tidak mengungkap data apa pun; ia cuma kunci pencarian ke DB.
- **Kontrol penuh atas masa berlaku** per session, plus pembersihan kedaluwarsa (`pruneExpired`, dipanggil saat login karena proyek ini tanpa cron).
- Disandingkan dengan cookie `httpOnly` dan `signed`, ini aman dari pencurian via JavaScript dan pemalsuan.

Trade-off-nya: setiap request perlu satu query DB untuk memvalidasi session. Untuk aplikasi ini (dashboard internal, bukan layanan publik berskala jutaan), biaya itu sangat sepadan dengan keamanan dan kontrol yang didapat.

Ringkasan alur penuh: user login, password dicek dengan `bcrypt.compare` (konstan waktu), server buat opaque token 256-bit lalu simpan di tabel `Session`, token dikirim sebagai cookie `sid` (httpOnly, signed), tiap request berikutnya cookie ikut otomatis, API baca dan verifikasi tanda tangan, validasi ke DB, baru boleh menyentuh data order. Frontend (middleware dan cookie forwarding) hanya membantu UX dan meneruskan cookie; gerbang keamanan sejati selalu di API.

## 6. Server API & alur data frontend (apps/api + apps/web)

Bagian ini menyambungkan dua dunia: **backend** (folder `apps/api`, sebuah server yang menerima request dan bicara ke database) dan **frontend** (folder `apps/web`, halaman yang dilihat user di browser). Kita akan ikuti satu garis lurus: bagaimana server dirakit, bagaimana GraphQL dipasang, bagaimana sebuah order dibuat, lalu bagaimana frontend menarik dan menampilkan datanya, sampai kotak "Live" yang membuat halaman menyegarkan dirinya sendiri.

Sedikit kosakata dulu (akan dijelaskan ulang saat muncul):

- **API** = Application Programming Interface, "pintu" tempat frontend meminta/mengirim data ke backend.
- **Fastify** = framework web untuk Node.js, tugasnya menerima HTTP request dan mengarahkannya ke fungsi yang tepat.
- **GraphQL** = bahasa query untuk API; frontend bilang persis field apa yang diinginkan, server hanya mengirim itu.
- **CORS, cookie, transaction** dijelaskan di tempatnya.

---

### 6.1 Merakit server Fastify (`apps/api/src/server.ts`)

File ini adalah "panitia perakitan". Ia membangun satu objek server dan menempelkan semua kemampuan secara berurutan.

```ts
const app = Fastify({ logger: opts.logger ?? true });

// Credentialed CORS
await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

// Signed cookies
await app.register(cookie, { secret: env.SESSION_SECRET });

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(webhookRoutes);
await app.register(graphqlPlugin);

return app;
```

Baris per baris:

- `Fastify({ logger: ... })`: membuat instance server. **Instance** = satu objek nyata yang siap dipakai. `logger: true` artinya setiap request dicatat ke konsol (berguna saat debugging).
- `app.register(cors, ...)`: **CORS** (Cross-Origin Resource Sharing) adalah aturan keamanan browser: secara default, halaman dari `localhost:3000` (frontend) tidak boleh memanggil `localhost:4000` (backend) karena beda "origin". `register` memasang plugin yang melonggarkan aturan ini secara terkontrol.
  - `origin: env.WEB_ORIGIN`: hanya izinkan origin frontend yang spesifik (mis. `http://localhost:3000`), bukan `*` (semua). Komentar di kode menegaskan kenapa: kita mengirim cookie sesi lintas-origin, dan browser melarang `*` digabung dengan cookie.
  - `credentials: true`: izinkan request membawa cookie. Tanpa ini, cookie sesi tidak akan ikut terkirim, jadi backend tidak tahu siapa user-nya.
- `app.register(cookie, { secret: ... })`: memasang dukungan cookie. **Signed cookie** = cookie yang ditandatangani dengan rahasia (`SESSION_SECRET`) supaya tidak bisa dipalsukan user. Id sesi disimpan di cookie `sid` yang `httpOnly` (tidak bisa dibaca JavaScript di browser, proteksi dari pencurian).
- Empat `register` berikutnya menempelkan **route** (alamat URL plus fungsi penanganannya): cek kesehatan server (`/health`), login/register (`/auth/*`), webhook pembayaran (`/webhook`), dan terakhir GraphQL.
- `return app`: fungsi mengembalikan server tanpa memanggil `listen` (membuka port).

**Kenapa begini:** dengan mengembalikan `app` alih-alih langsung menjalankannya, kita bisa memakai `app.inject()` di test integrasi, yaitu menembakkan request palsu ke server tanpa benar-benar membuka port jaringan. Ini membuat test cepat dan tidak bentrok. Urutan `register` juga penting: CORS dan cookie dipasang dulu supaya semua route di bawahnya otomatis mewarisi kemampuan itu.

---

### 6.2 Memasang GraphQL Yoga di atas Fastify (`apps/api/src/graphql/yoga-plugin.ts`)

**Yoga** adalah server GraphQL. Masalahnya: Yoga ingin membaca **body** (isi) request mentah-mentah sendiri, tapi Fastify secara default sudah keburu mem-parse JSON. File ini menyelesaikan konflik itu.

```ts
const yoga = createYoga<{ req: FastifyRequest; reply: FastifyReply }>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  graphiql: env.NODE_ENV === 'development',
  maskedErrors: env.NODE_ENV === 'production',
});

app.addContentTypeParser('application/json', {}, (_req, _payload, done) => done(null));
```

- `createYoga({...})`: membuat mesin GraphQL.
  - `schema`: gabungan `typeDefs` (definisi tipe/field yang tersedia) dan `resolvers` (fungsi yang benar-benar mengambil data tiap field). Ini "kontrak" API.
  - `graphqlEndpoint: '/graphql'`: alamatnya.
  - `graphiql: ... === 'development'`: **GraphiQL** adalah halaman eksplorasi interaktif untuk mencoba query; hanya dinyalakan saat development, dimatikan di production.
  - `maskedErrors: ... === 'production'`: di production, sembunyikan detail error (keamanan); di development/test, tampilkan apa adanya supaya pesan bisnis seperti `"Unknown SKU"` kelihatan.
- `addContentTypeParser('application/json', {}, ... done(null))`: ini parser **no-op** (tidak melakukan apa-apa) untuk JSON. Artinya: "jangan parse body, biarkan utuh." Sehingga Yoga bisa membacanya sendiri.

**Yang halus tapi penting:** parser ini hanya berlaku di scope plugin GraphQL. Komentar kode menyebut content-type parser bersifat **encapsulated** (terisolasi per plugin). Jadi route webhook REST di scope induk tetap memakai parsing JSON normalnya, tidak terganggu.

Lalu route-nya sendiri, dengan penjaga otentikasi:

```ts
app.route({
  url: '/graphql',
  method: ['GET', 'POST', 'OPTIONS'],
  preHandler: async (req, reply) => {
    if (req.method === 'OPTIONS') return;
    if (isDev && req.method === 'GET') return;
    const user = await getUserBySessionToken(readSessionToken(req));
    if (!user) {
      return reply.status(401).send({ errors: [{ message: 'Unauthorized' }] });
    }
  },
  handler: async (req, reply) => {
    const response = await yoga.handleNodeRequestAndResponse(req, reply, { req, reply });
    response.headers.forEach((value, key) => reply.header(key, value));
    reply.status(response.status);
    reply.send(response.body);
    return reply;
  },
});
```

- `preHandler` = fungsi yang berjalan **sebelum** handler utama; di sini ia penjaga keamanan.
  - `OPTIONS` dilewatkan, itu request "preflight" CORS dari browser, tidak membawa data, jadi aman.
  - Di dev, `GET` dilewatkan supaya halaman GraphiQL tetap bisa dibuka.
  - Selain itu: ambil token sesi dari cookie (`readSessionToken`), cari user-nya. Kalau tidak ada user valid, balas **401 Unauthorized** dan setop di sini.
- `handler`: kalau lolos, serahkan request ke Yoga (`handleNodeRequestAndResponse`), lalu salin header, status, dan body dari respons Yoga ke `reply` Fastify.

**Kenapa begini:** memisahkan otentikasi ke `preHandler` membuat aturannya jelas dan satu tempat, "tidak ada sesi, tidak ada akses GraphQL." Dan karena Yoga dijembatani manual, kita tetap pegang kendali penuh atas request/response Fastify.

---

### 6.3 Membuat order: harga, transaksi, dan event (`apps/api/src/services/order-service.ts`)

Inilah jantung lifecycle. Saat order lahir, statusnya **PENDING** (menunggu bayar). Fungsi `createOrder` yang melakukannya, dan caranya sangat hati-hati.

**Langkah 1, validasi dan ambil harga dari database, bukan dari client:**

```ts
const input = createOrderSchema.parse(rawInput);
const correlationId = `order_${randomUUID()}`;

const skus = input.items.map((i) => i.sku);
const inventory = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
const bySku = new Map(inventory.map((item) => [item.sku, item]));
```

- `createOrderSchema.parse(rawInput)`: validasi ulang input dengan **Zod** (pustaka validasi). Walaupun resolver GraphQL mungkin sudah validasi, fungsi ini memvalidasi lagi di "batas service" supaya aman dipanggil dari mana pun (resolver, test, CLI masa depan).
- `correlationId`: id unik untuk melacak satu rangkaian peristiwa terkait order ini (memudahkan menelusuri log).
- `findMany({ where: { sku: { in: skus } } })`: ambil semua produk yang SKU-nya cocok, dari tabel `InventoryItem`. **SKU** = Stock Keeping Unit, kode unik produk.
- `bySku`: buat `Map` (kamus) dari SKU ke produk, supaya pencarian per item cepat.

**Langkah 2, hitung harga dari data server:**

```ts
const lineItems = input.items.map((item) => {
  const product = bySku.get(item.sku);
  if (!product) throw new Error(`Unknown SKU: ${item.sku}`);
  return {
    sku: product.sku,
    name: product.name,
    quantity: item.quantity,
    unitPrice: product.unitPrice,
  };
});

const totalAmount = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
```

- Untuk tiap item, ambil `unitPrice` dan `name` **dari produk di database**, bukan dari yang dikirim client. Kalau SKU tidak dikenal, lempar error jelas.
- `totalAmount` = jumlah harga dikali kuantitas.

**Kenapa begini:** ini perlindungan kunci. Komentar kode bilang harga "never trusted from the client". Kalau kita pakai harga dari browser, user nakal bisa mengubah harga jadi Rp 1. Dengan mengambil harga dari tabel inventory server, total tidak bisa dimanipulasi. Catatan penting lain: stok TIDAK dikurangi di sini, reservasi stok terjadi nanti saat fulfillment (setelah bayar). Ini mencegah order yang belum dibayar mengunci stok.

**Langkah 3, satu transaksi: order, items, dan event:**

```ts
const created = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: {
      customerEmail: input.customerEmail,
      totalAmount,
      status: OrderStatus.PENDING,
      items: { create: lineItems },
    },
  });

  await writeEvent(tx, {
    orderId: order.id,
    type: OrderEventType.ORDER_CREATED,
    correlationId,
    payload: { customerEmail: order.customerEmail, totalAmount, items: lineItems },
  });

  return order;
});
```

- `prisma.$transaction(async (tx) => {...})`: **transaction** (transaksi database): sekelompok operasi yang harus semua berhasil atau semua batal. Tidak ada keadaan setengah jadi.
- Di dalamnya: buat `order` dengan status `PENDING` dan items-nya sekaligus, lalu tulis event `ORDER_CREATED`.
- Semua memakai `tx` (bukan `prisma` global) supaya ikut dalam transaksi yang sama.

**Kenapa begini:** komentar kode menjelaskan: order, item-itemnya, dan event "order.created" "either all land together or not at all." Bayangkan kalau order tersimpan tapi event-nya gagal, sistem event-driven kita tidak akan tahu order itu ada, dan fulfillment tak akan terpicu. Transaksi menjamin konsistensi: order yang ada pasti punya jejak event awal. Inilah pintu masuk lifecycle PENDING lalu PAID lalu FULFILLING lalu FULFILLED, event `ORDER_CREATED` adalah denyut pertama.

Terakhir, fungsi memanggil `getOrder(created.id)` untuk mengembalikan order lengkap (dengan relasi: items, payment, invoice, jobs, events) supaya GraphQL bisa menjawab field apa pun yang diminta.

---

### 6.4 Lapisan data frontend: satu klien GraphQL untuk dua dunia (`apps/web/src/lib/graphql.ts`)

Sekarang pindah ke frontend. Next.js punya dua jenis komponen (dijelaskan di 6.5), dan keduanya butuh ambil data. File ini menyediakan **satu** fungsi pemanggil GraphQL yang cerdas:

```ts
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  cookieHeader?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    credentials: 'include',
  });
  ...
}
```

- Parameter ketiga `cookieHeader` adalah kuncinya. Komentar menjelaskan dua skenario:
  - **Di browser**: `credentials: 'include'` membuat browser otomatis melampirkan cookie sesi. Jadi `cookieHeader` tidak perlu diisi.
  - **Di Server Component**: cookie browser tidak ikut otomatis (kode server tidak punya "browser"), jadi pemanggil harus mengoper `cookieHeader` secara manual.
- `...(cookieHeader ? { Cookie: cookieHeader } : {})`: sintaks penyebaran kondisional: kalau `cookieHeader` ada, tambahkan header `Cookie`; kalau tidak, jangan.
- `cache: 'no-store'`: jangan cache, selalu ambil data terbaru. Penting untuk dashboard operasi yang harus selalu fresh.
- Sisanya: lempar error kalau status HTTP gagal, atau kalau respons GraphQL berisi `errors`.

Di file yang sama ada `ORDER_FIELDS`, daftar field yang dibagi pakai oleh query order, plus query siap pakai:

```ts
export const ORDERS_QUERY = `query Orders($status: OrderStatus) { orders(status: $status) { ${ORDER_FIELDS} } }`;
export const ORDER_QUERY = `query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`;
```

**Kenapa begini:** komentar menegaskan file ini sengaja bebas dari `next/headers` supaya aman di-import di sisi client. Satu fungsi `graphqlRequest` melayani kedua dunia; perbedaannya cuma "apakah cookie diteruskan manual atau tidak." Membagi `ORDER_FIELDS` menghindari pengulangan, kalau ada field baru, cukup tambah di satu tempat.

---

### 6.5 Dua jenis komponen: Server vs Client (`queries.ts` vs `queries.server.ts`)

Next.js (versi App Router) punya dua jenis komponen:

- **Server Component** (default): kode berjalan **di server**, hasilnya HTML jadi dikirim ke browser. Tidak bisa pakai interaktivitas browser (klik, state), tapi bisa ambil data langsung dan aman menyimpan rahasia.
- **Client Component**: ditandai dengan `'use client'` di baris pertama file. Kode dikirim dan berjalan **di browser**, bisa interaktif (tombol, `useEffect`, `useState`).

Lapisan query dipisah mengikuti pembagian ini.

**`queries.ts`, untuk Client Component (cookie otomatis):**

```ts
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const data = await graphqlRequest<{ createOrder: Order }>(
    `mutation Create($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
    { input },
  );
  return data.createOrder;
}
```

- Perhatikan: `graphqlRequest` dipanggil tanpa argumen ketiga (cookie). Karena ini berjalan di browser, cookie ikut otomatis.
- Komentar di atas file menegaskan: "In the browser, the session cookie is sent automatically... Server Components must use ./queries.server instead."
- File ini juga berisi `sendPaymentWebhook` yang menarik: ia memanggil route Next sendiri (`/api/simulate-webhook`), yang menandatangani payload (HMAC) di server supaya rahasia penandatangan tidak pernah menyentuh browser.

**`queries.server.ts`, untuk Server Component (cookie diteruskan manual):**

```ts
import 'server-only';
import { cookies } from 'next/headers';

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const data = await graphqlRequest<{ order: Order | null }>(
    ORDER_QUERY,
    { id },
    await cookieHeader(), // <-- cookie diteruskan manual
  );
  return data.order;
}
```

- `import 'server-only'`: pengaman, kalau file ini tak sengaja di-import ke kode client, build **gagal**. Mencegah kebocoran logika/rahasia server ke browser.
- `cookies()` dari `next/headers`: membaca cookie dari request yang sedang ditangani server. `store.toString()` mengubahnya jadi satu string header `Cookie`.
- Setiap fetcher (`fetchOrders`, `fetchOrder`, `fetchDashboardMetrics`) mengoper `await cookieHeader()` sebagai argumen ketiga ke `graphqlRequest`, inilah "cookie forwarding" yang membuat backend tahu siapa user-nya.
- `fetchMe` dibungkus `try/catch` dan mengembalikan null, tidak melempar, supaya kerangka halaman tetap render walau user belum login atau API mati.

**Kenapa begini:** pemisahan dua file ini menegakkan aturan secara struktural. Server tidak punya akses otomatis ke cookie browser, jadi ia harus membacanya sendiri dan meneruskannya. Dengan `server-only` di satu sisi dan bebas-`next/headers` di sisi `graphql.ts`, kompiler ikut menjaga agar tidak ada yang dipakai di tempat salah.

---

### 6.6 Bagaimana sebuah halaman merender data (`app/page.tsx` & `app/orders/[id]/page.tsx`)

Kedua halaman ini adalah **Server Component** (tidak ada `'use client'`, fungsinya `async`). Mereka ambil data langsung lalu kembalikan HTML.

**Dashboard (`page.tsx`):**

```ts
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const [metrics, orders] = await Promise.all([fetchDashboardMetrics(), fetchOrders()]);
    const recent = orders.slice(0, 5);
    ...
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect('/login');
    return <ApiError error={error} />;
  }
}
```

- `export const dynamic = 'force-dynamic'`: beri tahu Next.js, **jangan** pre-render statis halaman ini; render ulang di setiap request. Wajib untuk data operasi yang selalu berubah.
- `await Promise.all([...])`: jalankan dua fetch (metrik plus daftar order) **bersamaan**, lalu tunggu keduanya. Lebih cepat daripada berurutan.
- Setelah dapat data, halaman mengolahnya: `orders.slice(0, 5)` ambil 5 terbaru, lalu (kode di bawahnya) mengelompokkan order per hari per tahap lifecycle untuk grafik throughput.
- Penanganan error: kalau error berstatus **401**, alihkan ke `/login`; selainnya tampilkan komponen `<ApiError>`. Inilah hilir dari penjaga 401 di yoga-plugin (6.2).

**Detail order (`orders/[id]/page.tsx`):**

```ts
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order;
  try {
    order = await fetchOrder(id);
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect('/login');
    return <ApiError error={error} />;
  }
  if (!order) notFound();

  const latestJob = order.fulfillmentJobs[0] ?? null;
  ...
}
```

- `params` adalah `Promise`, di Next.js versi ini, parameter URL di-`await`. `[id]` di nama folder berarti segmen dinamis: `/orders/abc` memetakan `id = "abc"`.
- `fetchOrder(id)` (dari `queries.server`) menarik order lengkap, dengan cookie diteruskan.
- `if (!order) notFound()`: kalau order tak ada, render halaman 404 bawaan.
- Sisanya menampilkan lifecycle secara visual: `<StatusStepper>` menunjukkan tahap (PENDING lalu PAID lalu FULFILLING lalu FULFILLED), bagian Payment/Invoice/Fulfillment, dan `<Timeline events={order.events} />` menampilkan jejak event yang lahir mulai dari `ORDER_CREATED` di 6.3.

**Kenapa begini:** karena ini Server Component, data sudah lengkap saat HTML dikirim, tidak ada "loading spinner" awal, dan SEO/aksesibilitas lebih baik. Penanganan error/redirect/notFound di level halaman membuat tiap kondisi (tak login, API mati, order hilang) punya respons yang jelas.

---

### 6.7 Auto-refresh: membuat halaman "hidup" (`components/AutoRefresh.tsx`)

Server Component tidak otomatis tahu kalau data di server berubah (mis. order pindah ke `FULFILLED` oleh proses latar belakang). Solusinya adalah satu **Client Component** kecil yang menyuruh halaman menyegarkan dirinya berkala. Ingat di 6.6, kedua halaman me-render `<AutoRefresh />`.

```ts
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  ...
}
```

- `'use client'`: wajib, karena ini pakai `useEffect` dan timer browser; harus jalan di browser.
- `useRouter()`: hook Next.js untuk navigasi/refresh program.
- `useEffect(() => {...}, [router, intervalMs])`: jalankan efek saat komponen muncul. `useEffect` = "lakukan sesuatu setelah render."
- `setInterval(..., intervalMs)`: setiap 3 detik (default), jalankan fungsi.
- `if (!document.hidden) router.refresh()`: `router.refresh()` menyuruh Next.js **menjalankan ulang Server Component** dan menarik data terbaru, lalu menambal halaman secara mulus (state interaktif lain tetap utuh). Cek `document.hidden` menjeda refresh saat tab tidak terlihat, hemat request.
- `return () => clearInterval(id)`: fungsi pembersih, saat komponen hilang, hentikan timer supaya tidak bocor.

**Kenapa begini:** ini pola "polling" sederhana namun efektif untuk dashboard operasi. Backend memproses pembayaran dan fulfillment secara asinkron (latar belakang), dan event-event itu menggeser status order. Tanpa auto-refresh, user harus reload manual untuk melihat order berpindah dari PAID lalu FULFILLING lalu FULFILLED. Dengan `AutoRefresh`, halaman terasa "live" (ada indikator titik hijau berdenyut plus label "Live"), Server Component yang statis pun jadi terasa real-time, tanpa perlu mesin WebSocket yang rumit.

---

**Ringkasan alur penuh:** browser membuka halaman, lalu Server Component (`page.tsx`) memanggil `queries.server`, yang meneruskan cookie sesi via `graphqlRequest`, lalu menembak `/graphql` di Fastify, `preHandler` memverifikasi sesi, Yoga menjalankan resolver, resolver memanggil service seperti `createOrder`/`getOrder`, Prisma membaca dan menulis database dalam transaksi dan mencatat event, data lengkap kembali ke halaman, HTML dirender, dan `<AutoRefresh>` (Client Component) memicu `router.refresh()` tiap 3 detik agar perubahan lifecycle terlihat otomatis.
