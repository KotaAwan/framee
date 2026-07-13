# System DocTypes: Language & Translation

Dokumen ini mendefinisikan *System DocTypes* yang bertanggung jawab untuk fitur Multi-Bahasa (i18n) pada aplikasi Framee.

---

## 1. DocType: `Language`

Tabel ini menyimpan daftar bahasa yang diaktifkan dan didukung oleh sistem. Data dari tabel ini akan muncul di _dropdown_ bahasa pada menu **User Profile**.

### Metadata
- **Name**: `Language`
- **Module**: `System`
- **Is Submittable**: `false`
- **Is Tree**: `false`
- **Track Changes**: `true`

### Fields (Kolom)

| Fieldname | Label | Fieldtype | Required | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `name` | Language Name | Data | Yes | Nama bahasa (misal: "English", "Bahasa Indonesia"). |
| `code` | Language Code | Data | Yes | Kode standar ISO (misal: `en`, `id`, `es`). Digunakan oleh sistem. |
| `is_active` | Is Active | Check | No | Hanya bahasa yang aktif yang bisa dipilih oleh User. |

---

## 2. DocType: `Translation`

Tabel ini berfungsi sebagai kamus (dictionary). Semua `label`, teks statis antarmuka, hingga nama `Module` akan diterjemahkan melalui tabel ini berdasarkan `Language` yang dipilih pengguna.

### Metadata
- **Name**: `Translation`
- **Module**: `System`
- **Is Submittable**: `false`
- **Is Tree**: `false`
- **Track Changes**: `true`

### Fields (Kolom)

| Fieldname | Label | Fieldtype | Required | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `language` | Target Language | Link (Language) | Yes | Referensi ke tabel `Language`. |
| `source_text` | Source Text | Text | Yes | Teks asli dalam bahasa bawaan (biasanya English). |
| `translated_text` | Translated Text | Text | Yes | Teks hasil terjemahan dalam bahasa target. |
| `context` | Context | Data | No | Opsional. Berguna jika satu kata memiliki banyak arti. |

---

## Mekanisme Terjemahan pada UI (Alur Pengguna)

1. **Pemilihan Bahasa**: 
   - Di dalam halaman **User Profile**, terdapat menu `Language Selector`.
   - *Dropdown* ini mengambil datanya dari tabel `Language` (`is_active = true`).
   - Ketika User memilih bahasa (contoh: "Bahasa Indonesia"), preferensi tersebut disimpan ke profil `User`.
2. **Pemanggilan Translasi**:
   - Setelah *User* menyimpan preferensinya (atau pada saat pertama kali *login*), *Frontend* memanggil API untuk mengambil seluruh kamus dari tabel `Translations` yang memiliki relasi dengan `Language` tersebut.
3. **Pengubahan Tampilan**:
   - Fungsi perantara di sisi klien (`useTranslation()`) akan memetakan *Source Text* dari setiap label atau menu menjadi *Translated Text*. 
   - Hal ini membuat tampilan berubah secara langsung menyesuaikan bahasa yang dipilih tanpa perlu mengubah *source code* *Frontend*.
