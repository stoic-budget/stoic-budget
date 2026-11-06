import type { StoicTextMap } from './types';

export const id: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Bulan ini melampaui rencananya',
      message:
        'Anda merencanakan {{plannedAmount}} dan telah membelanjakan {{spentAmount}} — {{percent}}% lebih banyak. Rencana dibuat dengan kepala dingin; biarkan suaranya lebih keras daripada dorongan sesaat.',
    },
    {
      title: '{{percent}}% melewati niat belanja Anda',
      message:
        'Pengeluaran mencapai {{spentAmount}} dibandingkan rencana {{plannedAmount}}. Lihat batas mana yang jebol lebih dulu — di situlah pelajarannya.',
    },
    {
      title: 'Rencana dan bulan Anda tidak sejalan',
      message:
        '{{spentAmount}} terpakai, {{plannedAmount}} yang diniatkan. Entah rencana terlalu sedikit meminta dari kenyataan, entah kenyataan terlalu banyak meminta dari Anda — putuskan yang mana, dengan tenang.',
    },
    {
      title: 'Lebih banyak keluar daripada yang Anda izinkan',
      message:
        'Bulan ini {{percent}}% di atas {{plannedAmount}} yang Anda tetapkan. Tidak ada yang hilang dengan berhenti sekarang; banyak yang hilang dengan berpura-pura tidak terjadi apa-apa.',
    },
    {
      title: 'Batas yang Anda buat, batas yang Anda lewati',
      message:
        'Anda berniat membelanjakan {{plannedAmount}}; kenyataannya {{spentAmount}}. Penguasaan diri bukan berarti tak pernah tergelincir — melainkan cepat menyadarinya dan kembali ke jalan.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Hiburan mengambil lebih dari rencana',
      message:
        'Anda bermaksud agar hiburan menjadi {{planned}}% dari pengeluaran; ternyata {{actual}}%. Kesenangan disambut sebagai tamu, bukan sebagai tuan rumah.',
    },
    {
      title: 'Hiburan {{actual}}%, rencana {{planned}}%',
      message:
        'Istirahat layak mendapat tempatnya ketika memulihkan Anda. Tanyakan kesenangan bulan itu mana yang melakukannya, dan lepaskan sisanya tanpa penyesalan.',
    },
    {
      title: 'Kenyamanan membelanjakan lebih dari niat',
      message:
        'Hiburan mengambil {{actual}}% pengeluaran dibandingkan {{planned}}% yang Anda pilih. Moderasi bukan menolak kesenangan — melainkan menjaganya sebesar yang Anda putuskan.',
    },
    {
      title: 'Yang menyenangkan mendesak yang direncanakan',
      message:
        'Anda memberi hiburan {{planned}}% dari rencana dan ia mengambil {{actual}}%. Apa yang mudah Anda nikmati layak dilihat dua kali sebelum menjadi kebutuhan.',
    },
    {
      title: 'Hiburan melangkahi garisnya',
      message:
        '{{actual}}% bulan ini untuk hiburan, niatnya {{planned}}%. Garis itu Anda yang menarik, dan Anda pula yang menjaganya.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Hiburan kembali melewati rencana',
      message:
        'Hiburan melewati rencana Anda dalam {{months}} dari {{window}} bulan terakhir. Pengulangan bukan lagi kebetulan — itu kebiasaan yang layak ditelaah.',
    },
    {
      title: '{{months}} dari {{window}} bulan di atas rencana hiburan',
      message:
        'Yang terjadi sekali adalah keadaan; yang terjadi {{months}} kali adalah watak yang sedang terbentuk. Pilihlah watak itu dengan sengaja.',
    },
    {
      title: 'Tergelincir yang sama, bulan demi bulan',
      message:
        'Hiburan melampaui rencana dalam {{months}} dari {{window}} bulan. Naikkan rencana dengan jujur atau ubah kebiasaannya — hidup di antara keduanya paling mahal.',
    },
    {
      title: 'Sebuah pola, bukan kekhilafan',
      message:
        'Dalam {{months}} dari {{window}} bulan terakhir, hiburan mengambil lebih dari yang Anda berikan. Perhatikan saat keputusan dibuat, bukan hanya tagihannya sesudahnya.',
    },
    {
      title: 'Kebiasaan memberi suara melawan rencana Anda',
      message:
        'Hiburan mengalahkan rencana {{months}} kali dalam {{window}} bulan. Kebiasaan dibangun satu pilihan demi satu pilihan; begitu pula meruntuhkannya.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Kebajikan mendapat kurang dari niat Anda',
      message:
        'Anda menyisihkan {{planned}}% anggaran untuk kesehatan, belajar, dan lainnya; ternyata {{actual}}%. Sebuah niat baru berarti setelah dilaksanakan.',
    },
    {
      title: 'Kebajikan {{actual}}% dari rencana {{planned}}%',
      message:
        'Uang yang Anda niatkan untuk hal yang membuat Anda lebih baik masih menunggu. Tidak ada saat yang lebih baik untuk membelanjakannya dengan baik selain sekarang.',
    },
    {
      title: 'Kebaikan yang direncanakan belum dibelanjakan',
      message:
        'Kesehatan, belajar, dan kemurahan hati seharusnya mendapat {{planned}}% pengeluaran; kenyataannya {{actual}}%. Lakukan salah satunya minggu ini, dengan sengaja.',
    },
    {
      title: 'Niat tanpa perbuatan',
      message:
        'Kebajikan mendapat {{actual}}% pengeluaran dibandingkan {{planned}}% yang Anda pilih. Apa yang kita hargai terlihat dari apa yang benar-benar kita bayar.',
    },
    {
      title: 'Masih ada ruang untuk yang penting',
      message:
        'Hanya {{actual}}% untuk kebajikan, padahal Anda merencanakan {{planned}}%. Sebuah buku, pemeriksaan kesehatan, hadiah bagi yang membutuhkan — rencana sudah mengatakan ya.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Kebajikan terus ditunda',
      message:
        'Pengeluaran untuk kesehatan, belajar, dan orang lain sudah {{months}} bulan berturut-turut di bawah rencana. Apa yang terus Anda tunda, sebenarnya sudah Anda tolak.',
    },
    {
      title: '{{months}} bulan kebajikan tertunda',
      message:
        'Setiap bulan rencana memberi ruang untuk hal yang membuat Anda lebih baik, dan setiap bulan ruang itu tak terpakai. Waktu adalah satu-satunya hal yang tidak bisa Anda anggarkan dua kali.',
    },
    {
      title: 'Diri Anda yang lebih baik masih menunggu',
      message:
        'Kebajikan sudah {{months}} bulan berturut-turut di bawah rencana. Mulailah kecil dan pasti, bukan besar dan nanti.',
    },
    {
      title: 'Niat baik mulai menua',
      message:
        'Selama {{months}} bulan kesehatan, belajar, dan kemurahan hati mendapat kurang dari rencana. Pilih satu dan danai lebih dulu bulan depan, sebelum yang lain.',
    },
    {
      title: 'Kebajikan terus kalah oleh “nanti”',
      message:
        '{{months}} bulan berturut-turut di bawah rencana. “Nanti” adalah tempat niat baik pergi untuk dilupakan — beri yang satu ini tanggal.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Rencana Anda tak memberi ruang bagi kebajikan',
      message:
        'Tidak ada anggaran Anda yang melayani kesehatan, belajar, atau orang lain. Rencana menunjukkan apa yang kita hargai — pertimbangkan memberi kebajikan barisnya sendiri.',
    },
    {
      title: 'Semua dianggarkan, kecuali kebaikan',
      message:
        'Kebutuhan, pekerjaan, dan hiburan punya batas; kebajikan tidak. Apa yang tak pernah direncanakan cenderung tak pernah terjadi.',
    },
    {
      title: 'Rencanakan hal yang membuat Anda lebih baik',
      message:
        'Belum ada anggaran di kelas kebajikan. Bahkan yang kecil — buku, olahraga, donasi — mengubah keinginan menjadi komitmen.',
    },
    {
      title: 'Rencana diam tentang kebajikan',
      message:
        'Anda menganggarkan yang wajib dan yang menyenangkan, tetapi belum untuk diri yang ingin Anda capai. Satu anggaran kebajikan yang sederhana akan mengubahnya.',
    },
    {
      title: 'Kebajikan tidak punya anggaran',
      message:
        'Pengeluaran untuk kesehatan, belajar, atau orang lain tidak direncanakan di mana pun. Pilih satu dan beri batas yang akan Anda senang capai.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Kebutuhan lebih mahal dari rencana',
      message:
        'Anda merencanakan {{planned}}% pengeluaran untuk kebutuhan; kenyataannya {{actual}}%. Periksa apakah masing-masing masih kebutuhan atau diam-diam menjadi kenyamanan.',
    },
    {
      title: 'Kebutuhan {{actual}}%, rencana {{planned}}%',
      message:
        'Apa yang dibutuhkan hidup biasanya lebih sedikit daripada yang kita biasakan. Tinjau kebutuhan terbesar dengan mata yang segar.',
    },
    {
      title: 'Pengeluaran pokok membengkak',
      message:
        'Kebutuhan mengambil {{actual}}% bulan ini dibandingkan {{planned}}% yang Anda perkirakan. Kebutuhan yang terus tumbuh layak dipertanyakan.',
    },
    {
      title: 'Kebutuhan melampaui rencana',
      message:
        'Rencana {{planned}}%, aktual {{actual}}%. Entah rencana meremehkan biaya sebenarnya, entah sebagian keinginan bepergian dengan nama kebutuhan.',
    },
    {
      title: 'Lebih banyak untuk “harus” daripada yang dimaksud',
      message:
        'Kebutuhan mengambil {{actual}}% pengeluaran, bukan {{planned}}%. Pisahkan yang benar-benar harus dari yang sekadar selalu ada.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Kebutuhan merayap naik',
      message:
        'Pengeluaran untuk kebutuhan naik {{months}} bulan berturut-turut, total {{percent}}%. Kebutuhan tumbuh diam-diam ketika tak ada yang meminta mereka membenarkan diri.',
    },
    {
      title: '+{{percent}}% untuk kebutuhan dalam {{months}} bulan',
      message:
        'Setiap langkah tampak kecil; bersama-sama tidak. Ambil kebutuhan rutin terbesar dan tanyakan apakah masih harus semahal ini.',
    },
    {
      title: 'Lantai pengeluaran Anda naik',
      message:
        'Kebutuhan tumbuh selama {{months}} bulan berturut-turut (+{{percent}}%). Lantai yang naik menyisakan lebih sedikit ruang bagi semua yang Anda pilih dengan bebas.',
    },
    {
      title: 'Kebutuhan meluas',
      message:
        '{{months}} bulan pertumbuhan, total {{percent}}%. Ujian Stoik itu sederhana: apakah Anda akan memilih ini lagi hari ini, dengan mengetahui harganya?',
    },
    {
      title: 'Kenaikan kecil, arah yang tetap',
      message:
        'Kebutuhan naik {{percent}}% selama {{months}} bulan. Arah lebih penting daripada satu bulan mana pun — yang ini layak dikoreksi sejak dini.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Pekerjaan lebih mahal dari rencana',
      message:
        'Anda merencanakan {{planned}}% pengeluaran untuk pekerjaan; kenyataannya {{actual}}%. Alat dan layanan harus sepadan dengan biayanya — periksa mana yang begitu.',
    },
    {
      title: 'Pengeluaran pekerjaan {{actual}}%, rencana {{planned}}%',
      message:
        'Investasi dalam pekerjaan baik bila memberi hasil. Tinjau apa yang Anda bayar tetapi tak lagi dipakai.',
    },
    {
      title: 'Anggaran pekerjaan meregang',
      message:
        'Pekerjaan mengambil {{actual}}%, bukan {{planned}}%. Ketekunan adalah mengerjakan pekerjaan dengan baik, bukan membeli setiap alat untuknya.',
    },
    {
      title: 'Alat-alat melampaui rencana',
      message:
        'Rencana {{planned}}%, terpakai {{actual}}% untuk pekerjaan. Tanyakan pada setiap pengeluaran: apakah ini membantu saya bekerja, atau hanya terasa seperti kemajuan?',
    },
    {
      title: 'Biaya pekerjaan bergeser',
      message:
        'Pekerjaan mengambil {{actual}}% pengeluaran dibandingkan {{planned}}% yang dimaksud. Pemeriksaan singkat sekarang menghemat pemeriksaan besar nanti.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}” kembali melewati batas',
      message:
        '“{{category}}” melampaui anggaran dalam {{months}} dari {{window}} bulan terakhir. Entah batasnya yang salah, entah keinginannya — putuskan yang mana.',
    },
    {
      title: '“{{category}}”: melewati anggaran {{months}} dari {{window}} bulan',
      message:
        'Batas yang selalu dilewati bukanlah batas, hanya harapan. Jadikan jujur — naikkan dengan sengaja atau pertahankan dengan sengaja.',
    },
    {
      title: 'Anggaran yang sama jebol lagi',
      message:
        '“{{category}}” melewati batasnya {{months}} kali dalam {{window}} bulan. Pengulangan adalah informasi; manfaatkan.',
    },
    {
      title: '“{{category}}” meminta perhatian Anda',
      message:
        'Melewati anggaran dalam {{months}} dari {{window}} bulan. Perhatikan saat sebelum membeli — hanya di situ kebiasaan bisa diubah.',
    },
    {
      title: 'Sebuah pola di “{{category}}”',
      message:
        '{{months}} kali melewati batas dalam {{window}} bulan. Apa yang kita ulangi, itulah kita jadinya; putuskan apa yang ingin dikatakan kategori ini tentang Anda.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}” habis pada tanggal {{day}}',
      message:
        'Anda telah membelanjakan {{spentAmount}} dari {{limitAmount}}, dan dengan laju ini batasnya habis sekitar tanggal {{day}}. Melambat sekarang lebih mudah daripada berhenti nanti.',
    },
    {
      title: '“{{category}}” mendahului bulannya',
      message:
        '{{spentAmount}} sudah terpakai dari batas {{limitAmount}}. Dengan laju ini habis pada tanggal {{day}} — sisa bulan masih bisa Anda bentuk.',
    },
    {
      title: 'Cek laju: “{{category}}”',
      message:
        'Anggaran {{limitAmount}} akan bertahan hingga sekitar tanggal {{day}} dengan laju saat ini. Kewaspadaan dini adalah disiplin yang paling murah.',
    },
    {
      title: '“{{category}}” membelanjakan masa depan',
      message:
        '{{spentAmount}} dari {{limitAmount}} terpakai; batas habis sekitar tanggal {{day}}. Apa yang Anda lakukan minggu ini menentukan apakah itu terjadi.',
    },
    {
      title: 'Peringatan dini untuk “{{category}}”',
      message:
        'Dengan laju saat ini, batas {{limitAmount}} tidak akan sampai akhir bulan — habis sekitar tanggal {{day}}. Sesuaikan selagi biayanya kecil.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}” tidak terpakai',
      message:
        'Anggaran “{{category}}” tidak ada pengeluaran selama {{months}} bulan. Entah Anda sudah tidak membutuhkannya, entah itu niat yang masih menunggu — putuskan yang mana.',
    },
    {
      title: 'Anggaran kosong: “{{category}}”',
      message:
        '{{months}} bulan tanpa satu pun pengeluaran. Rencana seharusnya menggambarkan hidup yang Anda jalani atau yang sedang Anda bangun — yang mana ini?',
    },
    {
      title: '“{{category}}” menganggur',
      message:
        'Tidak ada yang dibelanjakan di sini selama {{months}} bulan. Jika itu pengendalian diri, bagus; jika itu kelalaian, bertindaklah.',
    },
    {
      title: 'Direncanakan, tetapi tidak dijalani',
      message:
        '“{{category}}” punya batas tanpa pengeluaran selama {{months}} bulan. Jaga rencana tetap jujur: hapus atau gunakan.',
    },
    {
      title: '“{{category}}”: {{months}} bulan yang sepi',
      message:
        'Anggaran yang tak pernah disentuh tetap menempati tempat dalam rencana Anda. Kosongkan tempatnya atau hormati niatnya.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% pengeluaran tanpa batas',
      message:
        '{{unbudgetedAmount}} dari bulan itu mengalir ke kategori yang tidak diawasi anggaran mana pun. Apa yang belum Anda lihat, tak bisa Anda nilai.',
    },
    {
      title: 'Sebagian besar bulan ini tak terencana',
      message:
        '{{percent}}% pengeluaran — {{unbudgetedAmount}} — berada di luar semua anggaran. Beri batas pada bagian terbesarnya dan rencana akan melihat lebih banyak hidup Anda.',
    },
    {
      title: 'Pengeluaran di luar rencana',
      message:
        'Anggaran hanya mencakup sebagian dari yang Anda belanjakan; {{unbudgetedAmount}} ({{percent}}%) tidak terukur. Perluas rencana ke tempat uang benar-benar pergi.',
    },
    {
      title: 'Rencana hanya melihat sebagian gambaran',
      message:
        '{{percent}}% pengeluaran bulan itu tidak memiliki anggaran. Melihat dengan jernih mendahului menilai dengan baik.',
    },
    {
      title: '{{unbudgetedAmount}} dibelanjakan tanpa batas',
      message:
        'Itu {{percent}}% dari bulan ini. Anda tidak harus membatasinya — cukup putuskan berapa banyak yang benar-benar Anda inginkan.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}” adalah sebagian besar hiburan Anda',
      message:
        '{{percent}}% pengeluaran hiburan mengalir ke “{{category}}”. Nikmatilah, tetapi pastikan Anda bisa melepaskannya.',
    },
    {
      title: 'Satu kesenangan mendominasi',
      message:
        '“{{category}}” mengambil {{percent}}% dari semua yang Anda belanjakan untuk hiburan. Tanyakan apakah itu masih menggembirakan atau sudah menjadi rutinitas.',
    },
    {
      title: 'Hiburan bertumpu pada “{{category}}”',
      message:
        '{{percent}}% hiburan di satu tempat. Apa yang tak bisa kita tinggalkan menggenggam kita — pastikan genggamannya masih ringan.',
    },
    {
      title: '“{{category}}”: {{percent}}% hiburan',
      message:
        'Satu sumber kesenangan mengambil hampir semuanya. Jalani tanpanya untuk sementara dan lihat apa yang sebenarnya diberikannya.',
    },
    {
      title: 'Istirahat Anda punya satu alamat',
      message:
        'Sebagian besar uang hiburan, {{percent}}%, mengalir ke “{{category}}”. Anda bebas dari sebuah kesenangan hanya jika Anda sanggup hidup tanpanya.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Sebagian pengeluaran belum dinilai',
      message:
        'Kategori tanpa kelas: {{count}}. Tentukan di Anggaran mana yang kebutuhan, pekerjaan, kebajikan, atau hiburan.',
    },
    {
      title: '{{count}} kategori menunggu penilaian Anda',
      message:
        'Ada pengeluaran tetapi tanpa kelas, jadi saran tidak bisa menimbangnya. Satu menit di Anggaran menyelesaikannya.',
    },
    {
      title: 'Namai apa yang dilayani uang Anda',
      message:
        'Kategori yang masih belum berkelas: {{count}}. Penilaian dimulai dengan menyebut sesuatu dengan nama yang benar.',
    },
    {
      title: 'Pengeluaran belum dinilai: {{count}} kategori',
      message:
        'Apakah ini kebutuhan, pekerjaan Anda, kebajikan, atau kesenangan? Hanya Anda yang bisa mengatakannya — dan rencana menjadi lebih jelas setelahnya.',
    },
    {
      title: 'Beberapa kategori belum berkelas',
      message:
        'Kategori di luar empat kelas: {{count}}. Klasifikasikan di Anggaran agar setiap pengeluaran terlihat apa adanya.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} pembelian kecil di {{merchant}}',
      message:
        'Masing-masing tampak sepele; bersama-sama berjumlah {{totalAmount}} dalam sebulan. Kebiasaan kecil yang tak diperiksa adalah tempat kebanyakan uang pergi diam-diam.',
    },
    {
      title: '{{merchant}}: {{count}} kali dalam sebulan',
      message:
        '{{totalAmount}} dalam jumlah kecil. Tanyakan apakah tiap kunjungan adalah pilihan atau refleks: hanya yang pertama adalah kebebasan.',
    },
    {
      title: 'Sedikit demi sedikit: {{totalAmount}}',
      message:
        '{{count}} pembelian di {{merchant}}. Tak satu pun penting; kebiasaannya yang penting. Putuskan seberapa sering Anda benar-benar menginginkannya.',
    },
    {
      title: 'Kebiasaan di {{merchant}}',
      message:
        '{{count}} pembelian, total {{totalAmount}}. Coba lewatkan satu dari tiga dan lihat apakah Anda merasa kehilangan.',
    },
    {
      title: 'Hal kecil menumpuk',
      message:
        'Anda ke {{merchant}} {{count}} kali, senilai {{totalAmount}}. Penguasaan atas keputusan besar dibangun di atas keputusan kecil seperti ini.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Akhir pekan memikul {{percent}}% hiburan',
      message:
        'Sebagian besar pengeluaran hiburan Anda terjadi pada Sabtu dan Minggu. Istirahat itu baik; pastikan itu istirahat, bukan pelampiasan atas minggu yang berat.',
    },
    {
      title: 'Hiburan tinggal di akhir pekan',
      message:
        '{{percent}}% pengeluaran hiburan jatuh pada akhir pekan. Rencanakan akhir pekan sedikit, dan ia akan lebih murah serta memberi lebih banyak.',
    },
    {
      title: 'Akhir pekan membelanjakan untuk seminggu',
      message:
        'Akhir pekan mengambil {{percent}}% dari yang Anda belanjakan untuk hiburan. Jika minggu Anda perlu diperbaiki setiap Sabtu, lihatlah minggunya.',
    },
    {
      title: 'Sabtu dan Minggu: {{percent}}% hiburan',
      message:
        'Hari bebas mengundang belanja bebas. Putuskan sebelum akhir pekan untuk apa ia, dan biarkan uang mengikuti.',
    },
    {
      title: 'Pola akhir pekan',
      message:
        '{{percent}}% pengeluaran hiburan terjadi di akhir pekan. Kelonggaran di hari kerja sering membuat akhir pekan lebih murah.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} mengambil {{percent}}% bulan ini',
      message:
        '{{totalAmount}} masuk ke satu pedagang untuk hiburan. Ketika satu tempat memegang uang Anda sebanyak itu, tanyakan seberapa banyak ia memegang perhatian Anda juga.',
    },
    {
      title: 'Satu tempat, {{totalAmount}}',
      message:
        '{{merchant}} adalah {{percent}}% dari pengeluaran bulan itu. Apakah sepadan dengan porsi kerja hidup Anda sebesar itu?',
    },
    {
      title: '{{merchant}} memimpin pengeluaran Anda',
      message:
        '{{percent}}% bulan ini — {{totalAmount}} — pergi ke sana. Tidak salah menikmatinya, selama Anda akan memilihnya lagi.',
    },
    {
      title: 'Porsi besar di {{merchant}}',
      message:
        '{{totalAmount}}, atau {{percent}}% pengeluaran, di satu tempat hiburan. Timbang kesenangan terhadap harganya, dengan tenang.',
    },
    {
      title: '{{percent}}% di {{merchant}}',
      message:
        'Satu pedagang ini mengambil {{totalAmount}}. Kebebasan adalah mampu melewatinya saat Anda memilih.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Pendapatan turun, pengeluaran tidak',
      message:
        'Pendapatan turun {{percent}}% menjadi {{incomeAmount}}, tetapi pengeluaran tetap {{expenseAmount}}. Nasib berubah pikiran; pengeluaran Anda belum menyadarinya.',
    },
    {
      title: 'Pendapatan turun {{percent}}%',
      message:
        '{{incomeAmount}} masuk, {{expenseAmount}} keluar. Apa yang diberikan nasib bisa diambilnya kembali — sesuaikan pengeluaran dengan yang ada, bukan yang dulu.',
    },
    {
      title: 'Bulan yang lebih ramping, kebiasaan yang sama',
      message:
        'Pendapatan {{percent}}% lebih rendah ({{incomeAmount}}), sementara pengeluaran bertahan di {{expenseAmount}}. Pendapatan tidak dalam kuasa Anda; tanggapan Anda ya.',
    },
    {
      title: 'Nasib bergeser',
      message:
        'Anda menghasilkan {{percent}}% lebih sedikit dari biasanya, tetapi membelanjakan {{expenseAmount}} seperti sebelumnya. Pangkas sekarang, selagi itu pilihan, bukan keharusan.',
    },
    {
      title: 'Pengeluaran belum mengikuti pendapatan',
      message:
        'Pendapatan turun menjadi {{incomeAmount}} ({{percent}}% lebih rendah); pengeluaran {{expenseAmount}}. Sesuaikan layar dengan angin yang benar-benar Anda miliki.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Langganan: {{monthlyAmount}} sebulan',
      message:
        '{{count}} langganan mengambil {{percent}}% pengeluaran bulanan Anda. Masing-masing diperpanjang tanpa bertanya — tanyakan sendiri tentang masing-masing.',
    },
    {
      title: '{{percent}}% pengeluaran memperpanjang dirinya sendiri',
      message:
        '{{count}} langganan, {{monthlyAmount}} sebulan. Pertahankan hanya yang akan Anda pilih lagi hari ini.',
    },
    {
      title: 'Diam, berulang, {{monthlyAmount}}',
      message:
        '{{count}} langganan menghabiskan {{percent}}% bulan Anda. Kemudahan adalah pelayan yang baik dan tuan yang mahal.',
    },
    {
      title: '{{count}} langganan untuk ditinjau',
      message:
        'Bersama-sama {{monthlyAmount}} sebulan, {{percent}}% pengeluaran. Batalkan satu yang jarang Anda pakai dan perhatikan betapa sedikit Anda merindukannya.',
    },
    {
      title: 'Yang diperpanjang dengan sendirinya',
      message:
        '{{monthlyAmount}} sebulan untuk {{count}} langganan. Pengeluaran otomatis layak ditinjau dengan sengaja.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Keberhasilan Anda bisa menjangkau sedikit lebih jauh',
      message:
        'Selama {{months}} bulan Anda menyimpan {{savingsPercent}}% pendapatan, tetapi hampir tidak ada yang sampai ke orang lain. Kekayaan paling baik berada di tangan yang terbuka — mungkin satu hadiah atau donasi bulan ini?',
    },
    {
      title: 'Penghasilan baik, pemberian sedikit',
      message:
        'Selama {{months}} bulan masuk {{incomeAmount}} dan {{givenAmount}} diberikan kepada orang lain. Jika Anda membantu dengan cara yang tidak terlihat oleh aplikasi ini, abaikan saja; jika tidak, rencana Anda masih punya ruang untuk itu.',
    },
    {
      title: 'Saat yang baik untuk bermurah hati',
      message:
        'Anda menabung {{savingsPercent}}% pendapatan — tanda pengelolaan yang mantap. Sebagian kecil darinya, diberikan kepada yang membutuhkan, akan membuat kemantapan itu lebih bermakna.',
    },
    {
      title: 'Belum ada orang lain dalam gambaran',
      message:
        '{{months}} bulan terakhir menunjukkan penghasilan dan tabungan yang dikelola dengan cermat, tetapi tanpa sedekah atau hadiah. Kita diciptakan untuk satu sama lain; hadiah sederhana sudah cukup untuk memulai.',
    },
    {
      title: 'Ruang untuk kebaikan',
      message:
        'Hanya {{givenAmount}} dari {{incomeAmount}} yang digunakan untuk membantu orang lain. Pertimbangkan donasi kecil yang rutin — seperti setiap kebajikan, kemurahan hati makin mudah dengan kebiasaan.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}” tertinggal',
      message:
        'Dibutuhkan {{requiredAmount}} sebulan, dan Anda menyetor sekitar {{paceAmount}}. Dengan laju ini, tujuan tercapai terlambat {{monthsLate}} bulan. Lajunya ada dalam kuasa Anda.',
    },
    {
      title: '“{{goal}}”: terlambat {{monthsLate}} bulan dengan laju ini',
      message:
        'Diperlukan {{requiredAmount}} sebulan, kenyataannya sekitar {{paceAmount}}. Geser tanggalnya dengan jujur atau alihkan lebih banyak uang dengan sengaja.',
    },
    {
      title: 'Tujuan dan laju tidak sejalan',
      message:
        '“{{goal}}” meminta {{requiredAmount}} sebulan; ia mendapat {{paceAmount}}. Tujuan hanya senyata langkah bulanan menujunya.',
    },
    {
      title: '“{{goal}}” butuh langkah yang lebih mantap',
      message:
        '{{paceAmount}} sebulan dibandingkan {{requiredAmount}} yang dibutuhkan. Bayar tujuan lebih dulu bulan depan, sebelum apa pun yang opsional.',
    },
    {
      title: 'Tertinggal pada “{{goal}}”',
      message:
        'Laju saat ini ({{paceAmount}}/bulan) membuatnya terlambat {{monthsLate}} bulan. Yang ada dalam kuasa Anda adalah langkah berikutnya, bukan seluruh perjalanan.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}” tidak muat dalam rencana',
      message:
        'Tujuan ini butuh {{requiredAmount}} sebulan, tetapi setelah anggaran hanya {{freeAmount}} yang bebas. Ubah tanggal, target, atau anggaran — berharap bukanlah rencana.',
    },
    {
      title: '“{{goal}}” meminta lebih dari dana bebas Anda',
      message:
        '{{requiredAmount}} diperlukan setiap bulan, {{freeAmount}} tersedia. Menginginkan semuanya sekaligus adalah cara agar tak ada yang selesai; pilihlah.',
    },
    {
      title: 'Angka berkata tidak — untuk saat ini',
      message:
        '“{{goal}}” butuh {{requiredAmount}} sebulan; dana bebas Anda {{freeAmount}}. Sesuaikan apa yang dalam kuasa Anda: tenggat atau batas lainnya.',
    },
    {
      title: '“{{goal}}” butuh keputusan',
      message:
        'Dengan {{requiredAmount}} sebulan, ia melebihi {{freeAmount}} yang tersisa setelah anggaran. Tujuan yang dipilih dengan mata terbuka lebih baik daripada yang dipertahankan dengan angan-angan.',
    },
    {
      title: 'Laju yang mustahil untuk “{{goal}}”',
      message:
        'Diperlukan {{requiredAmount}} per bulan, bebas {{freeAmount}}. Hitungan jujur sekarang mencegah kekecewaan nanti.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Saldo Anda turun di bawah nol pada {{date}}',
      message:
        'Dengan pendapatan dan pengeluaran seperti sekarang, saldo proyeksi turun hingga {{lowestAmount}}. Bersiaplah sekarang, selagi baru berupa perkiraan.',
    },
    {
      title: 'Kekurangan dana mendekat: {{date}}',
      message:
        'Pembayaran dan pengeluaran sehari-hari melampaui pemasukan, dengan titik terendah {{lowestAmount}}. Mengantisipasi kesulitan adalah cara menghilangkan kuasanya.',
    },
    {
      title: 'Rencanakan untuk {{date}}',
      message:
        'Pada hari itu proyeksi saldo mencapai {{lowestAmount}}. Geser satu pembayaran, tahan satu keinginan, atau sisihkan uang tunai — semua itu dalam kuasa Anda hari ini.',
    },
    {
      title: 'Perkiraan jatuh di bawah nol',
      message:
        'Saldo turun ke {{lowestAmount}} sekitar {{date}}. Tanggapan yang tenang adalah tanggapan yang dini.',
    },
    {
      title: 'Antisipasi celah pada {{date}}',
      message:
        'Proyeksi saldo terendah: {{lowestAmount}}. Apa yang sudah diduga dapat dihadapi dengan tenang; apa yang mengejutkan, jarang.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Anda menepati janji pada diri sendiri',
      message:
        'Sudah {{months}} bulan berturut-turut pengeluaran Anda tetap dalam rencana yang Anda buat sendiri. Beginilah wujud penguasaan diri.',
    },
    {
      title: '{{months}} bulan sesuai rencana',
      message:
        'Bulan demi bulan, apa yang Anda niatkan dan apa yang Anda lakukan selaras. Konsistensi lebih sunyi daripada tekad, dan bertahan lebih lama.',
    },
    {
      title: 'Rencana dan hidup selaras',
      message:
        '{{months}} bulan berturut-turut di dalam batas Anda. Rencana yang dijaga sebaik ini bukan lagi pembatasan — itulah cara Anda hidup.',
    },
    {
      title: 'Stabil selama {{months}} bulan',
      message:
        'Anggaran Anda bertahan {{months}} bulan berturut-turut. Pertahankan perhatian yang sama; itu berhasil.',
    },
    {
      title: 'Disiplin yang bertahan',
      message:
        '{{months}} bulan tanpa melanggar rencana. Sedikit hal yang semembebaskan memercayai keputusan Anda sendiri.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Uang Anda mengikuti nilai Anda',
      message:
        'Uang yang melayani kebajikan mencapai {{actual}}% dari pengeluaran Anda, tidak kurang dari {{planned}}% yang direncanakan. Dibelanjakan dengan baik.',
    },
    {
      title: 'Kebajikan mendapat bagian penuhnya',
      message:
        '{{actual}}% untuk kesehatan, belajar, dan orang lain, dibandingkan {{planned}}% yang direncanakan. Apa yang Anda hargai, Anda bayar.',
    },
    {
      title: 'Dibelanjakan untuk menjadi lebih baik',
      message:
        'Kesehatan, belajar, dan lainnya mendapat {{actual}}% dari pengeluaran bulan itu (rencana {{planned}}%). Kebajikan tidak bisa dibeli, tetapi bisa dilayani.',
    },
    {
      title: 'Niat yang terlaksana',
      message:
        'Anda merencanakan {{planned}}% untuk kebajikan dan membelanjakan {{actual}}%. Niat baik jarang bertahan sebulan — niat Anda bertahan.',
    },
    {
      title: 'Penggunaan uang terbaik',
      message:
        '{{actual}}% pergi ke hal yang membuat Anda dan orang lain lebih baik. Teruslah memilihnya.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Hiburan pada tempatnya',
      message:
        'Hiburan {{actual}}% dari pengeluaran, di bawah {{planned}}% yang Anda izinkan. Anda menikmati banyak hal tanpa dikuasai olehnya.',
    },
    {
      title: 'Kesenangan, sesuai ukurannya',
      message:
        'Hiburan mengambil {{actual}}% dibandingkan rencana {{planned}}%. Moderasi bukan kehilangan — melainkan memilih.',
    },
    {
      title: 'Istirahat tanpa berlebihan',
      message:
        '{{actual}}% untuk hiburan, di bawah batas {{planned}}% Anda. Kesenangan terasa lebih nikmat ketika bukan ia yang memegang kendali.',
    },
    {
      title: 'Pengendalian diri, dengan tenang',
      message:
        'Anda memberi hiburan {{planned}}% dan ia hanya memakai {{actual}}%. Selisih itu adalah kebebasan yang Anda jaga.',
    },
    {
      title: 'Hiburan di bawah rencana',
      message:
        'Pada {{actual}}% pengeluaran, hiburan tetap di bawah {{planned}}% yang Anda tetapkan. Terjaga dengan baik.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% di bawah rencana',
      message:
        'Anda membelanjakan {{savedAmount}} lebih sedikit daripada yang Anda izinkan untuk bulan itu. Tidak membutuhkan segala yang bisa Anda miliki adalah sejenis kekayaan.',
    },
    {
      title: '{{savedAmount}} tidak terpakai',
      message:
        'Bulan ini berakhir {{percent}}% di bawah rencana. Apa yang tidak Anda belanjakan masih bisa Anda arahkan.',
    },
    {
      title: 'Kurang dari yang Anda izinkan',
      message:
        'Pengeluaran {{percent}}% di bawah rencana — {{savedAmount}} tersimpan. Beri selisih itu tujuan sebelum kebiasaan merebutnya.',
    },
    {
      title: 'Rencana masih punya ruang',
      message:
        '{{savedAmount}} di bawah batas Anda untuk bulan itu. Pengendalian diri yang terasa mudah adalah yang bertahan.',
    },
    {
      title: 'Lebih ringan dari rencana',
      message:
        'Anda membutuhkan {{percent}}% lebih sedikit dari anggaran. Pertimbangkan mengirim {{savedAmount}} ke sebuah tujuan.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}” sesuai jadwal',
      message:
        'Anda sudah {{percent}}% menuju sana, dengan laju yang dibutuhkan tujuan ini. Langkah mantap, diambil setiap bulan, sampai jauh.',
    },
    {
      title: 'Di jalur menuju “{{goal}}”',
      message:
        '{{percent}}% selesai dan lajunya terjaga. Terus bayar tujuan lebih dulu; itu berhasil.',
    },
    {
      title: '“{{goal}}”: {{percent}}% dan stabil',
      message: 'Tujuan mendapat apa yang dibutuhkannya setiap bulan. Kesabaran sedang bekerja.',
    },
    {
      title: 'Tujuan bergerak sesuai rencana',
      message:
        '“{{goal}}” terdanai {{percent}}% dan tepat waktu. Apa yang dikerjakan sedikit demi sedikit setiap bulan tak bisa dihentikan oleh satu minggu yang buruk.',
    },
    {
      title: 'Kemajuan yang bisa dipercaya',
      message:
        '“{{goal}}” berada di {{percent}}%, sesuai laju. Anda membangunnya dengan satu-satunya cara yang berhasil — bertahap.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Lebih sedikit pembelian impulsif di {{merchant}}',
      message:
        'Dari {{before}} pembelian dalam sebulan menjadi sekitar {{after}}. Kebiasaan yang mengendur adalah kebebasan yang diraih.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Anda berkunjung lebih jarang dari biasanya. Setiap refleks yang dilewati adalah kemenangan kecil pilihan atas kebiasaan.',
    },
    {
      title: 'Kebiasaan kecil menyusut',
      message:
        'Pembelian di {{merchant}} turun dari {{before}} menjadi sekitar {{after}}. Teruskan — akan makin mudah.',
    },
    {
      title: 'Pilihan di atas refleks',
      message:
        'Di {{merchant}} Anda turun dari {{before}} pembelian menjadi sekitar {{after}}. Itulah penguasaan diri yang dibangun satu keputusan demi satu keputusan.',
    },
    {
      title: 'Lebih sedikit hal kecil',
      message:
        'Anda ke {{merchant}} sekitar {{after}} kali, bukan {{before}}. Kemenangan kecil berlipat ganda.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Anda menyesuaikan diri dengan bulan yang lebih ramping',
      message:
        'Pendapatan turun {{incomePercent}}%, dan Anda memangkas pengeluaran {{expensePercent}}%. Anda menghadapi perubahan nasib dengan perubahan arah.',
    },
    {
      title: 'Tetap tenang saat pendapatan turun',
      message:
        'Pendapatan turun {{incomePercent}}%, pengeluaran turun {{expensePercent}}%. Anda menyesuaikan diri dengan yang ada, bukan yang dulu.',
    },
    {
      title: 'Nasib berubah; Anda pun berubah',
      message:
        'Penurunan pendapatan {{incomePercent}}% dijawab dengan penurunan pengeluaran {{expensePercent}}%. Itulah ketenangan batin dalam angka.',
    },
    {
      title: 'Kemudi yang baik',
      message:
        'Saat pendapatan turun {{incomePercent}}%, pengeluaran mengikuti ({{expensePercent}}% lebih sedikit). Anginnya bukan milik Anda; layarnya ya.',
    },
    {
      title: 'Pengeluaran ikut turun bersama pendapatan',
      message:
        'Anda membelanjakan {{expensePercent}}% lebih sedikit ketika pendapatan turun {{incomePercent}}%. Menyesuaikan diri lebih awal adalah jalan yang tenang.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Kebutuhan stabil',
      message:
        'Selama {{months}} bulan biaya pokok Anda nyaris tak bergerak. Lantai yang stabil memberi Anda kebebasan di atasnya.',
    },
    {
      title: 'Kebutuhan terkendali',
      message:
        'Pengeluaran kebutuhan bertahan datar selama {{months}} bulan. Kebutuhan yang tidak tumbuh adalah kebutuhan yang Anda kendalikan.',
    },
    {
      title: '{{months}} bulan kebutuhan pokok yang stabil',
      message:
        'Sewa, makanan, dan tagihan tetap di tempatnya. Stabilitas yang tenang juga sebuah pencapaian.',
    },
    {
      title: 'Kebutuhan tidak merayap',
      message:
        '{{months}} bulan tanpa pergeseran pada apa yang dibutuhkan hidup. Segala hal lain lebih mudah direncanakan di atas pijakan itu.',
    },
    {
      title: 'Lantai yang kokoh',
      message:
        'Pengeluaran pokok stabil selama {{months}} bulan. Anda tidak membiarkan kenyamanan menyamar sebagai kebutuhan.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Murah hati dengan penghasilan Anda',
      message:
        'Selama {{months}} bulan, {{percent}}% pendapatan Anda — {{givenAmount}} — digunakan untuk membantu orang lain. Itulah uang yang dipakai sebaik-baiknya.',
    },
    {
      title: '{{givenAmount}} diberikan kepada orang lain',
      message:
        'Anda membagikan {{percent}}% pendapatan dalam {{months}} bulan. Kebaikan yang tampak dalam angka adalah kebaikan yang dijalankan, bukan hanya dirasakan.',
    },
    {
      title: 'Tangan yang terbuka',
      message:
        'Akhir-akhir ini sedekah dan hadiah mengambil {{percent}}% pendapatan Anda. Apa yang Anda berikan adalah bagian kekayaan Anda yang tak bisa diambil oleh kemalangan apa pun.',
    },
    {
      title: 'Kemurahan hati adalah bagian dari rencana Anda',
      message:
        '{{givenAmount}} untuk orang lain selama {{months}} bulan. Pertahankan — kebaikan yang Anda lakukan bagi orang lain juga kebaikan bagi diri sendiri.',
    },
    {
      title: 'Diberikan dengan baik',
      message:
        '{{percent}}% dari penghasilan Anda digunakan untuk membantu orang lain. Sedikit kebiasaan yang berbicara lebih banyak tentang seseorang.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Tidak ada yang perlu dikoreksi',
      message: 'Pengeluaran Anda sesuai dengan niat Anda. Teruskan seperti ini.',
    },
    {
      title: 'Niat dan tindakan selaras',
      message: 'Bulan itu tampak seperti yang Anda rencanakan. Keselarasan itulah intinya.',
    },
    {
      title: 'Bulan yang tenang',
      message:
        'Tidak ada yang berlebihan, tidak ada kelalaian yang patut disebut. Bagus — bawa perhatian yang sama ke depan.',
    },
    {
      title: 'Semua beres',
      message:
        'Rencana Anda bertahan dan tak ada yang perlu dikoreksi. Nikmati ketenangan yang Anda raih.',
    },
    {
      title: 'Tangan yang mantap',
      message:
        'Bulan ini mengikuti rencana Anda. Kebiasaan baik membuat bulan-bulan baik tampak biasa.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Simpan bagian Anda lebih dulu',
      message:
        'Dalam {{months}} bulan Anda menyimpan {{savingsPercent}}% dari pendapatan. Peringatan Seneca: sudah terlambat berhemat ketika sampai di dasar tong. Sisihkan {{tenthAmount}} pada hari uang masuk.',
    },
    {
      title: 'Berhemat di bagian atas tong',
      message:
        'Hanya {{savingsPercent}}% pendapatan yang tertinggal pada Anda. Hemat yang menunggu sisa datang terlalu lambat; {{tenthAmount}} sebulan, disisihkan lebih dulu, memulainya sekarang.',
    },
    {
      title: 'Yang menjadi milik Anda, simpanlah',
      message:
        'Seneca menganjurkan menyimpan apa yang benar-benar milik Anda dan mulai sejak dini. Belakangan {{savingsPercent}}% pendapatan tertinggal pada Anda; mulailah dengan {{tenthAmount}} di hari gajian dan biarkan pengeluaran menyesuaikan diri dengan sisanya.',
    },
    {
      title: 'Mulailah sebelum tinggal ampas',
      message:
        'Anda menyimpan {{savingsPercent}}% selama {{months}} bulan. Menabung hanya ada dalam kuasa Anda selama masih ada yang bisa ditabung: sisihkan {{tenthAmount}} sebelum apa pun.',
    },
    {
      title: '{{savingsPercent}}% tersimpan, dan tong terus berkurang',
      message:
        '{{tenthAmount}} sebulan, sepersepuluh pendapatan, disisihkan sebelum tagihan apa pun. Apa yang Anda simpan lebih dulu tidak bergantung pada apa yang disisakan bulan itu.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Bersiaplah selagi tenang',
      message:
        'Cadangan Anda menutup sekitar {{cushionDays}} hari pengeluaran. Seneca: jiwa harus mengeraskan diri di masa yang bebas dari kecemasan. Pengeluaran tiga bulan berjumlah {{targetAmount}}.',
    },
    {
      title: 'Cadangan {{cushionDays}} hari',
      message:
        'Nasib tidak memberi pengumuman. Bangunlah menuju {{targetAmount}}, pengeluaran tiga bulan, selagi tidak ada yang mendesak: saat itulah semuanya mudah.',
    },
    {
      title: '“Inikah keadaan yang dulu kutakutkan?”',
      message:
        'Seneca menyuruh Lucilius melatih kemiskinan agar kehilangan kengeriannya. Dengan cadangan {{cushionDays}} hari, satu bulan yang berat bukan lagi sekadar latihan. Bidiklah {{targetAmount}}.',
    },
    {
      title: 'Antisipasi bulan yang berat',
      message:
        'Tabungan Anda akan bertahan sekitar {{cushionDays}} hari. Yang sudah diperkirakan datang dengan lembut; {{targetAmount}} akan menopang Anda selama tiga bulan.',
    },
    {
      title: 'Bangun tembok sebelum badai',
      message:
        'Sekitar {{cushionDays}} hari sudah tertutup. Kehilangan pendapatan bukan dalam kuasa Anda; cadangan itu dalam kuasa Anda. Pengeluaran tiga bulan berjumlah {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Keinginan mendahului pendapatan',
      message:
        'Pengeluaran naik {{expenseGrowth}}% dalam kuartal terakhir, sedangkan pendapatan berubah {{incomeGrowth}}%. Bukan orang yang terlalu sedikit memiliki, tulis Seneca, melainkan orang yang mendambakan lebih banyaklah yang miskin.',
    },
    {
      title: 'Hidup lebih tinggi, bukan lebih baik',
      message:
        'Pengeluaran tumbuh {{expenseGrowth}}%, pendapatan {{incomeGrowth}}%. Kebutuhan alam itu sedikit; tuntutan opini tidak terbatas. Tanyakan tuntutan mana yang dilayani oleh kenaikan itu.',
    },
    {
      title: 'Keinginan membesar: +{{expenseGrowth}}%',
      message:
        'Pengeluaran naik lebih cepat daripada pendapatan ({{incomeGrowth}}%). Kenyamanan baru segera terasa seperti kebutuhan: sadarilah selagi Anda masih bisa menolaknya.',
    },
    {
      title: 'Garis tujuan terus bergeser',
      message:
        'Pengeluaran naik {{expenseGrowth}}% dari kuartal ke kuartal, sedangkan pendapatan {{incomeGrowth}}%. Cukup tetap cukup hanya jika Anda sendiri yang menentukan seberapa itu.',
    },
    {
      title: 'Lebih banyak bukan obatnya',
      message:
        'Dalam kuartal terakhir pengeluaran tumbuh {{expenseGrowth}}% dan pendapatan {{incomeGrowth}}%. Kekayaan yang tumbuh bersama keinginan tidak pernah tiba; tetapkan batasnya sebelum ini menjadi hal yang biasa.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} menghabiskan {{hours}} jam hidup Anda',
      message:
        'Seneca mengingatkan bahwa hanya waktu yang benar-benar milik kita. {{totalAmount}} di {{merchant}} setara sekitar {{hours}} jam kerja Anda. Apakah itu sepadan?',
    },
    {
      title: '{{hours}} jam di {{merchant}}',
      message:
        'Kita menjaga uang dan memberikan waktu begitu saja. Dengan rata-rata penghasilan per jam Anda, {{totalAmount}} di sana kira-kira {{hours}} jam kerja.',
    },
    {
      title: 'Hargai dalam jam',
      message:
        '{{totalAmount}} di {{merchant}} setara sekitar {{hours}} jam kerja. Jam adalah satu-satunya hal yang tidak bisa Anda hasilkan kembali.',
    },
    {
      title: 'Berapa sebenarnya biaya {{merchant}}',
      message:
        'Anda menukar hari-hari Anda dengan uang, dan uang dengan benda. {{merchant}} mengambil sekitar {{hours}} jam Anda ({{totalAmount}}). Apakah kesenangannya sepadan dengan jam-jam itu?',
    },
    {
      title: 'Timbanglah jam-jamnya',
      message:
        'Dikonversi ke rata-rata penghasilan per jam Anda, {{totalAmount}} di {{merchant}} sekitar {{hours}} jam. Kita kehilangan sangat banyak waktu kita, tulis Seneca. Apakah ini pilihan Anda?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Aturan “{{rule}}” kehilangan arah',
      message:
        'Aturan ini menunjuk sesuatu yang sudah tidak ada, sehingga diam-diam berhenti bekerja. Perbaiki atau hapus: keteraturan yang tidak berbuat apa-apa hanya tampak seperti keteraturan.',
    },
    {
      title: '“{{rule}}” tidak lagi bekerja',
      message:
        'Kategori, akun, atau penerimanya sudah tiada, dan aturan ini kini dilewati pada setiap transaksi. Lihat keadaan apa adanya, lalu perbaiki.',
    },
    {
      title: 'Aturan yang tidak menunjuk apa pun',
      message:
        '“{{rule}}” mengirim transaksi ke tempat yang sudah dihapus. Dulu Anda memutuskan sesuatu; putuskan lagi, sekarang setelah keadaan berubah.',
    },
    {
      title: '“{{rule}}” membutuhkan pertimbangan Anda',
      message:
        'Yang dirujuknya telah dihapus, dan transaksi yang dulu ia golongkan kini menunggu Anda. Beri tujuan baru atau lepaskan.',
    },
    {
      title: 'Aturan yang rusak, tanpa suara',
      message:
        '“{{rule}}” tidak berbuat apa-apa dan tidak mengatakan apa-apa. Perbaiki yang ada dalam kuasa Anda: hanya butuh semenit.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Tangan Anda tidak sependapat dengan “{{rule}}”',
      message:
        'Sebanyak {{count}} kali Anda menggolongkan secara manual apa yang oleh aturan ini digolongkan ke tempat lain. Entah aturannya yang keliru, entah tangan Anda: putuskan yang mana.',
    },
    {
      title: '“{{rule}}” dikesampingkan {{count}} kali',
      message:
        'Aturan yang terus Anda koreksi bukan lagi keputusan, hanya kebiasaan berdebat dengan diri sendiri. Ubah atau percayai.',
    },
    {
      title: 'Katakan apa yang Anda lakukan, lakukan apa yang Anda katakan',
      message:
        'Aturan “{{rule}}” berkata satu hal; {{count}} koreksi terakhir Anda berkata hal lain. Selaraskan keduanya.',
    },
    {
      title: 'Keputusan yang dipersengketakan',
      message:
        'Anda menetapkan “{{rule}}” dengan kepala dingin, dan sejak itu {{count}} transaksi berjalan ke arah lain. Tinjau lagi dengan tenang, siapa di antara kalian yang benar.',
    },
    {
      title: '{{count}} koreksi melawan “{{rule}}”',
      message:
        'Pengulangan adalah informasi. Biarkan ia mengubah aturan, atau biarkan aturan mengubah kebiasaan.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Putuskan sekali untuk {{payee}}',
      message:
        'Anda telah menggolongkan {{payee}} secara manual {{decided}} kali, selalu dengan cara yang sama. Apa yang Anda putuskan berulang-ulang, putuskan sekali saja, dengan kepala dingin.',
    },
    {
      title: 'Keputusan yang diambil {{decided}} kali',
      message:
        '{{payee}} terus mengajukan pertanyaan yang sama dan Anda terus memberi jawaban yang sama. Sebuah aturan akan menyimpan perhatian Anda untuk hal yang sungguh membutuhkannya.',
    },
    {
      title: 'Penerima yang siap diberi aturan: {{count}}',
      message:
        'Penerima yang sama terus Anda beri kategori yang sama, {{payee}} yang paling sering. Simpan pertimbangan Anda untuk hal yang baru.',
    },
    {
      title: 'Kebiasaan Anda siap menjadi prinsip',
      message:
        'Anda menggolongkan {{payee}} dengan cara yang sama setiap kali ({{decided}} sejauh ini). Tuliskan sebagai aturan dan ia akan bertahan tanpa usaha.',
    },
    {
      title: 'Biarkan sebuah aturan memikul ini',
      message:
        'Penerima yang Anda golongkan dengan cara yang sama setiap kali: {{count}}, dengan {{payee}} terbanyak, {{decided}} transaksi. Prinsip yang ditetapkan sekali tidak perlu diperdebatkan lagi.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” tidak menemui apa pun selama {{months}} bulan',
      message:
        'Entah dunia yang menjadi tujuannya telah lenyap, entah syaratnya meleset. Jagalah aturan Anda tetap benar: perbaiki atau hapus.',
    },
    {
      title: 'Aturan yang beristirahat: “{{rule}}”',
      message:
        'Ia tidak menyentuh satu transaksi pun selama {{months}} bulan. Buanglah yang berlebihan; yang tersisa akan lebih mudah dipercaya.',
    },
    {
      title: '“{{rule}}” menganggur',
      message:
        '{{months}} bulan tanpa kecocokan sementara transaksi baru terus berdatangan. Uji pada transaksi terbaru Anda, lalu putuskan.',
    },
    {
      title: 'Apakah “{{rule}}” masih diperlukan?',
      message:
        'Tidak ada yang cocok dengannya selama {{months}} bulan. Aturan yang dipertahankan karena kebiasaan adalah satu hal lagi yang harus diurus.',
    },
    {
      title: 'Keputusan tanpa apa pun untuk diputuskan',
      message:
        '“{{rule}}” diam selama {{months}} bulan. Keteraturan berarti memiliki apa yang diperlukan, dan hanya itu.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Keputusan Anda bertahan',
      message:
        'Aturan menggolongkan {{percent}}% transaksi bulan itu, dan Anda tidak perlu membatalkannya. Keputusan yang diambil sekali dan dipegang membebaskan pikiran.',
    },
    {
      title: '{{percent}}% sudah beres sebelumnya',
      message:
        'Sebagian besar transaksi bulan itu digolongkan menurut apa yang telah Anda putuskan sebelumnya. Itu perhatian yang dihemat untuk hal yang penting.',
    },
    {
      title: 'Prinsip yang bekerja',
      message:
        'Aturan Anda menangani {{percent}}% transaksi tanpa sengketa. Prinsip yang mapan membuat hari-hari tenang.',
    },
    {
      title: 'Lebih sedikit yang diputuskan',
      message:
        '{{percent}}% transaksi tidak memerlukan keputusan baru. Anda menilai sekali, dengan baik, dan penilaian itu masih berlaku.',
    },
    {
      title: 'Keteraturan terjaga',
      message:
        'Aturan menggolongkan {{percent}}% transaksi bulan itu, dan tak satu pun dibantah. Keteraturan yang baik tampak seperti tidak ada yang terjadi.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” tidak punya tanggal',
      message:
        'Posisinya {{percent}}% dan tidak ada yang masuk. Bila tidak tahu pelabuhan mana yang dituju, tak ada angin yang tepat: tetapkan hari Anda ingin tiba.',
    },
    {
      title: 'Sebuah angan, atau tujuan?',
      message:
        '“{{goal}}” tidak punya tenggat dan tidak punya laju. Tujuan adalah keputusan dengan tanggal; beri ia tanggal atau lepaskan.',
    },
    {
      title: 'Tetapkan hari untuk “{{goal}}”',
      message:
        'Sudah {{percent}}% dari perjalanan dan tidak bergerak. Apa yang bisa dilakukan kapan saja jarang dilakukan sama sekali.',
    },
    {
      title: '“{{goal}}” menunggu “suatu hari”',
      message:
        'Belakangan tidak ada yang masuk, dan tak ada tanggal yang menuntut apa pun. “Suatu hari” tidak ada di kalender Anda; pilih hari yang ada.',
    },
    {
      title: '“{{goal}}” tidak punya pelabuhan',
      message:
        'Di {{percent}}%, tanpa tenggat. Ketahuilah ke mana Anda berlayar, dan langkah bulanan akan menyusul.',
    },
  ],
};
