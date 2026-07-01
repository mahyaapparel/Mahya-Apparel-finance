import streamlit as st
import pandas as pd
from datetime import datetime

# Konfigurasi halaman Streamlit
st.set_page_config(page_title="Mahya Finance", layout="wide", page_icon="💰")

# --- FITUR LOGIN SEDERHANA ---
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False

if not st.session_state["logged_in"]:
    st.title("🔑 Login Mahya Finance")
    st.markdown("Masukkan kredensial Anda untuk mengakses sistem keuangan.")
    
    with st.form("login_form"):
        username = st.text_input("Username", value="admin")
        password = st.text_input("Password", type="password", value="password")
        submitted = st.form_submit_button("Masuk 🚀")
        
        if submitted:
            if username == "admin" and password == "password":
                st.session_state["logged_in"] = True
                st.success("Login Berhasil!")
                st.rerun()
            else:
                st.error("Username atau password salah! (Gunakan: admin / password)")
    st.stop()

# --- HEADER SETELAH LOGIN ---
st.sidebar.markdown(f"👤 **Pengguna:** Admin")
if st.sidebar.button("Logout 🚪"):
    st.session_state["logged_in"] = False
    st.rerun()

st.title("💰 Mahya Finance")
st.markdown("Aplikasi pencatatan keuangan sederhana untuk divisi **Konveksi**, **Sablon**, **Aksesori**, dan log transaksi **Alat**.")
st.markdown("---")

# Inisialisasi session state untuk menyimpan data transaksi secara persisten dalam sesi
if "transactions" not in st.session_state:
    st.session_state["transactions"] = [
        # Data sampel awal untuk ilustrasi langsung
        {"Tanggal": "2026-06-28", "Divisi": "Konveksi", "Jenis": "Pemasukan", "Nominal": 1500000, "Keterangan": "Uang muka pesanan 100 pcs kaos polos"},
        {"Tanggal": "2026-06-29", "Divisi": "Konveksi", "Jenis": "Pengeluaran", "Nominal": 600000, "Keterangan": "Pembelian bahan kain cotton combed 30s"},
        {"Tanggal": "2026-06-29", "Divisi": "Sablon", "Jenis": "Pemasukan", "Nominal": 800000, "Keterangan": "Pelunasan sablon jaket kelas XII IPA"},
        {"Tanggal": "2026-06-30", "Divisi": "Aksesori", "Jenis": "Pemasukan", "Nominal": 350000, "Keterangan": "Penjualan gantungan kunci & stiker merchandise"},
        {"Tanggal": "2026-06-30", "Divisi": "Sablon", "Jenis": "Pengeluaran", "Nominal": 200000, "Keterangan": "Pembelian tinta plastisol hitam & emulsi sablon"},
    ]

# Membuat layout kolom: Sidebar untuk form input, Main Panel untuk ringkasan dan tabel
with st.sidebar:
    st.header("✍️ Input Transaksi Baru")
    st.info("Silakan masukkan detail transaksi baru di bawah ini:")
    
    with st.form("transaction_form", clear_on_submit=True):
        tanggal = st.date_input("Pilih Tanggal", value=datetime.today())
        divisi = st.selectbox("Pilih Divisi", ["Konveksi", "Sablon", "Aksesori", "Alat"])
        
        # Alat does not have sales or expenses, only transaction logs
        if divisi == "Alat":
            jenis = "Pemasukan" # set as Pemasukan internally
            st.info("Pencatatan Transaksi Alat (Aset & Log)")
        else:
            jenis = st.selectbox("Jenis Transaksi", ["Pemasukan", "Pengeluaran"])
            
        nominal = st.number_input("Nominal (Rp)", min_value=0, step=1000, format="%d")
        keterangan = st.text_input("Keterangan / Catatan")
        
        submitted = st.form_submit_button("Simpan Transaksi 💾")
        if submitted:
            if nominal <= 0:
                st.error("Gagal! Nominal harus lebih besar dari Rp 0.")
            elif not keterangan.strip():
                st.error("Gagal! Keterangan/Catatan wajib diisi.")
            else:
                new_tx = {
                    "Tanggal": tanggal.strftime("%Y-%m-%d"),
                    "Divisi": divisi,
                    "Jenis": jenis,
                    "Nominal": int(nominal),
                    "Keterangan": keterangan.strip()
                }
                st.session_state["transactions"].append(new_tx)
                st.success(f"Berhasil! Transaksi {divisi} sebesar Rp {int(nominal):,} disimpan.")
                st.rerun()

# --- BAGIAN PERHITUNGAN KEUANGAN (REAL-TIME METRIC) ---
def hitung_keuangan(divisi_nama):
    pemasukan = sum(tx["Nominal"] for tx in st.session_state["transactions"] if tx["Divisi"] == divisi_nama and tx["Jenis"] == "Pemasukan")
    pengeluaran = sum(tx["Nominal"] for tx in st.session_state["transactions"] if tx["Divisi"] == divisi_nama and tx["Jenis"] == "Pengeluaran")
    laba = pemasukan - pengeluaran
    return pemasukan, pengeluaran, laba

pem_konveksi, peng_konveksi, laba_konveksi = hitung_keuangan("Konveksi")
pem_sablon, peng_sablon, laba_sablon = hitung_keuangan("Sablon")
pem_aksesori, peng_aksesori, laba_aksesori = hitung_keuangan("Aksesori")

# Alat is purely logged separately without core revenue calculations
alat_transactions = [tx for tx in st.session_state["transactions"] if tx["Divisi"] == "Alat"]
alat_count = len(alat_transactions)
total_alat_value = sum(tx["Nominal"] for tx in alat_transactions)

total_pemasukan = pem_konveksi + pem_sablon + pem_aksesori
total_pengeluaran = peng_konveksi + peng_sablon + peng_aksesori
total_laba = laba_konveksi + laba_sablon + laba_aksesori

# --- TAMPILAN METRIC CARDS ---
st.subheader("📊 Ringkasan Laba Bersih per Divisi (Real-Time)")
col1, col2, col3, col4, col5 = st.columns(5)

# Format rupiah custom untuk Streamlit
def fmt_rp(val):
    return f"Rp {val:,.0f}".replace(",", ".")

with col1:
    st.metric(
        label="Laba Konveksi", 
        value=fmt_rp(laba_konveksi), 
        delta=f"Masuk: {fmt_rp(pem_konveksi)} | Keluar: {fmt_rp(peng_konveksi)}",
        delta_color="normal"
    )

with col2:
    st.metric(
        label="Laba Sablon", 
        value=fmt_rp(laba_sablon), 
        delta=f"Masuk: {fmt_rp(pem_sablon)} | Keluar: {fmt_rp(peng_sablon)}",
        delta_color="normal"
    )

with col3:
    st.metric(
        label="Laba Aksesori", 
        value=fmt_rp(laba_aksesori), 
        delta=f"Masuk: {fmt_rp(pem_aksesori)} | Keluar: {fmt_rp(peng_aksesori)}",
        delta_color="normal"
    )

with col4:
    st.metric(
        label="Transaksi Divisi Alat", 
        value=fmt_rp(total_alat_value), 
        delta=f"{alat_count} Transaksi Log",
        delta_color="off"
    )

with col5:
    st.metric(
        label="Total Laba Konsolidasi (3 Divisi)", 
        value=fmt_rp(total_laba), 
        delta=f"Total Masuk: {fmt_rp(total_pemasukan)}",
        delta_color="off"
    )

st.markdown("---")

# --- TABEL DATA TRANSAKSI PEMISAHAN KOLOM ---
st.subheader("📋 Tabel Rincian Keuangan per Divisi")
st.markdown("Semua transaksi dipisahkan ke dalam kolom masing-masing divisi secara otomatis.")

table_rows = []
for index, tx in enumerate(st.session_state["transactions"]):
    div = tx["Divisi"]
    jenis = tx["Jenis"]
    nom = tx["Nominal"]
    
    row = {
        "No": index + 1,
        "Tanggal": tx["Tanggal"],
        "Keterangan Konveksi": "",
        "Pemasukan Konveksi": 0,
        "Pengeluaran Konveksi": 0,
        "Laba Konveksi": 0,
        "Keterangan Sablon": "",
        "Pemasukan Sablon": 0,
        "Pengeluaran Sablon": 0,
        "Laba Sablon": 0,
        "Keterangan Aksesori": "",
        "Pemasukan Aksesori": 0,
        "Pengeluaran Aksesori": 0,
        "Laba Aksesori": 0,
        "Keterangan Alat": "",
        "Transaksi Alat": 0,
    }
    
    if div == "Konveksi":
        row["Keterangan Konveksi"] = tx["Keterangan"]
        if jenis == "Pemasukan":
            row["Pemasukan Konveksi"] = nom
            row["Laba Konveksi"] = nom
        else:
            row["Pengeluaran Konveksi"] = nom
            row["Laba Konveksi"] = -nom
    elif div == "Sablon":
        row["Keterangan Sablon"] = tx["Keterangan"]
        if jenis == "Pemasukan":
            row["Pemasukan Sablon"] = nom
            row["Laba Sablon"] = nom
        else:
            row["Pengeluaran Sablon"] = nom
            row["Laba Sablon"] = -nom
    elif div == "Aksesori":
        row["Keterangan Aksesori"] = tx["Keterangan"]
        if jenis == "Pemasukan":
            row["Pemasukan Aksesori"] = nom
            row["Laba Aksesori"] = nom
        else:
            row["Pengeluaran Aksesori"] = nom
            row["Laba Aksesori"] = -nom
    elif div == "Alat":
        row["Keterangan Alat"] = tx["Keterangan"]
        row["Transaksi Alat"] = nom
            
    table_rows.append(row)

if len(table_rows) > 0:
    df = pd.DataFrame(table_rows)
    df = df.set_index("No")
    
    # --- FITUR EXPORT / DOWNLOAD DATA ---
    st.sidebar.subheader("📥 Ekspor Data Keuangan")
    csv = df.to_csv(sep=";").encode("utf-8")
    st.sidebar.download_button(
        label="Unduh Laporan Excel (.csv) 📊",
        data=csv,
        file_name=f"Laporan_Keuangan_Divisi_{datetime.today().strftime('%Y-%m-%d')}.csv",
        mime="text/csv",
    )
    
    formatted_df = df.style.format({
        "Pemasukan Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Konveksi": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pemasukan Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Sablon": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pemasukan Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Pengeluaran Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Laba Aksesori": lambda x: fmt_rp(x) if x != 0 else "-",
        "Transaksi Alat": lambda x: fmt_rp(x) if x != 0 else "-",
    })
    st.dataframe(formatted_df, use_container_width=True)
else:
    st.info("Belum ada data transaksi. Masukkan transaksi baru lewat panel kiri untuk memulai!")

# Footer informasi tambahan
st.markdown("---")
st.caption("Mahya Finance v1.1 • Aplikasi Keuangan Multi-Divisi • Dikembangkan dengan Streamlit")
