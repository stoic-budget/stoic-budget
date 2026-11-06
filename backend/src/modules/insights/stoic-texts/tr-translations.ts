import type { StoicTextMap } from './types';

export const tr: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Ay planını aştı',
      message:
        'Planladığınız tutar {{plannedAmount}}, harcanan tutar {{spentAmount}} — planın %{{percent}} üzerinde. Plan berrak bir zihinle yapıldı; bırakın anın sesinden daha yüksek konuşsun.',
    },
    {
      title: 'Harcamak istediğinizin %{{percent}} üzerinde',
      message:
        'Harcama, {{plannedAmount}} tutarındaki plana karşı {{spentAmount}} düzeyinde. Önce hangi sınırın gevşediğine bakın — ders oradadır.',
    },
    {
      title: 'Planınız ve ayınız anlaşamıyor',
      message:
        'Harcanan: {{spentAmount}}, niyet edilen: {{plannedAmount}}. Ya plan gerçeklikten çok az istedi ya da gerçeklik sizden çok fazla — hangisi olduğuna sakince karar verin.',
    },
    {
      title: 'İzin verdiğinizden fazlası çıktı',
      message:
        'Ay, belirlediğiniz {{plannedAmount}} tutarının %{{percent}} üzerinde. Şimdi durmakla hiçbir şey kaybedilmez; olmamış gibi davranmakla çok şey kaybedilir.',
    },
    {
      title: 'Koyduğunuz sınır, geçtiğiniz sınır',
      message:
        'Harcamayı {{plannedAmount}} ile sınırlamayı düşünmüştünüz; tutar {{spentAmount}} oldu. Kendine hâkim olmak hiç sendelememek değildir — erken fark edip yola dönmektir.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Eğlence planladığınızdan fazlasını alıyor',
      message:
        'Eğlencenin harcamalarınızın %{{planned}} kadarı olmasını istemiştiniz; %{{actual}} oldu. Haz konuk olarak hoş geldi, evin efendisi olarak değil.',
    },
    {
      title: 'Eğlence %{{actual}}, plan %{{planned}}',
      message:
        'Dinlenme, sizi yenilediğinde yerini hak eder. Ayın zevklerinden hangilerinin bunu yaptığını sorun, gerisini pişmanlıksız bırakın.',
    },
    {
      title: 'Rahatlık niyetten fazla harcıyor',
      message:
        'Eğlence harcamaların %{{actual}} kadarını tutuyor; seçtiğiniz oran %{{planned}} idi. Ölçülülük zevki reddetmek değil, onu karar verdiğiniz boyutta tutmaktır.',
    },
    {
      title: 'Hoş olan, planlananı kenara itiyor',
      message:
        'Plan eğlenceye %{{planned}} pay vermişti; eğlence %{{actual}} aldı. Kolayca keyif aldığınız şey, bir ihtiyaca dönüşmeden önce ikinci bir bakışı hak eder.',
    },
    {
      title: 'Eğlence çizgisini aştı',
      message:
        'Ayın %{{actual}} kadarı eğlenceye gitti, niyet %{{planned}} idi. O çizgiyi siz çizdiniz; korumak da size düşer.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Eğlence yine planı aştı',
      message:
        'Eğlence son {{window}} ayın {{months}} ayında planınızı aştı. Tekrar artık tesadüf değil, incelemeye değer bir alışkanlık.',
    },
    {
      title: 'Son {{window}} ayın {{months}} ayında eğlence planı aşıldı',
      message:
        'Bir kez olan şey koşuldur; {{months}} kez olan şey oluşmakta olan bir karakterdir. O karakteri bilerek seçin.',
    },
    {
      title: 'Ay be ay aynı kayma',
      message:
        'Eğlence {{window}} ayın {{months}} ayında planı aştı. Ya planı dürüstçe yükseltin ya da alışkanlığı değiştirin — ikisinin arasında yaşamak en pahalısıdır.',
    },
    {
      title: 'Bir dalgınlık değil, bir örüntü',
      message:
        'Son {{window}} ayın {{months}} ayında eğlence ona verdiğinizden fazlasını aldı. Yalnızca sonradan gelen hesaba değil, kararın verildiği ana dikkat edin.',
    },
    {
      title: 'Alışkanlık planınıza karşı oy veriyor',
      message:
        'Eğlence {{window}} ay içinde {{months}} kez planı geçti. Alışkanlıklar her seferinde bir seçimle kurulur; çözülmeleri de öyle.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Erdem niyetinizden azını alıyor',
      message:
        'Bütçenizin %{{planned}} kadarını sağlık, öğrenme ve benzerlerine ayırmıştınız; %{{actual}} oldu. Bir niyet, yerine getirildiğinde sayılır.',
    },
    {
      title: 'Erdem: planlanan %{{planned}}, gerçekleşen %{{actual}}',
      message:
        'Sizi daha iyi yapan şeye ayırdığınız para hâlâ bekliyor. İyi harcamak için şimdiden iyi bir zaman yok.',
    },
    {
      title: 'Planladığınız iyilik harcanmadı',
      message:
        'Sağlık, öğrenme ve cömertlik harcamaların %{{planned}} kadarını alacaktı; %{{actual}} aldı. Bu hafta bunlardan birini bilinçli olarak yapın.',
    },
    {
      title: 'Eylemsiz niyet',
      message:
        'Erdem harcamaların %{{actual}} kadarını tutuyor; seçtiğiniz oran %{{planned}}. Neye değer verdiğimiz, gerçekte neye para ödediğimizde görünür.',
    },
    {
      title: 'Önemli olana hâlâ yer var',
      message:
        'Erdeme yalnızca %{{actual}} gitti, oysa %{{planned}} planlamıştınız. Bir kitap, bir sağlık kontrolü, ihtiyacı olan birine bir bağış — plan zaten evet dedi.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Erdem yine erteleniyor',
      message:
        'Sağlık, öğrenme ve başkaları için harcama {{months}} aydır üst üste planınızın altında. Sürekli ertelediğiniz şeyi aslında çoktan reddetmişsiniz.',
    },
    {
      title: '{{months}} aydır ertelenen erdem',
      message:
        'Plan her ay sizi daha iyi yapan şeylere yer açtı ve her ay o yer boş kaldı. Zaman, iki kez bütçeleyemeyeceğiniz tek şeydir.',
    },
    {
      title: 'Daha iyi hâliniz hâlâ bekliyor',
      message:
        'Erdem {{months}} aydır üst üste planın altında. Büyük ve sonra yerine küçük ve kesin başlayın.',
    },
    {
      title: 'İyi niyetler yaşlanıyor',
      message:
        '{{months}} aydır sağlık, öğrenme ve cömertlik planlanandan az aldı. Birini seçin ve gelecek ay her şeyden önce onu finanse edin.',
    },
    {
      title: 'Erdem hep “sonra”ya yeniliyor',
      message:
        '{{months}} ay üst üste planın altında. “Sonra”, iyi niyetlerin unutulmaya gittiği yerdir — bu niyete bir tarih verin.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Planınızda erdeme yer yok',
      message:
        'Bütçelerinizin hiçbiri sağlığa, öğrenmeye veya başkalarına hizmet etmiyor. Plan neye değer verdiğimizi gösterir — erdeme kendi satırını vermeyi düşünün.',
    },
    {
      title: 'Her şeye bütçe var, iyiliğe yok',
      message:
        'Zorunluluk, iş ve eğlencenin sınırları var; erdemin yok. Hiç planlanmayan şey genellikle hiç gerçekleşmez.',
    },
    {
      title: 'Sizi daha iyi yapan şeyi planlayın',
      message:
        'Erdem sınıfında henüz bütçe yok. Küçük bir tanesi bile — kitaplar, spor, bir bağış — bir dileği bir taahhüde dönüştürür.',
    },
    {
      title: 'Plan erdem konusunda sessiz',
      message:
        'Zorunda olduklarınız ve hoşlandıklarınız için bütçe yapıyorsunuz, olmak istediğiniz kişi için henüz değil. Mütevazı bir erdem bütçesi bunu değiştirir.',
    },
    {
      title: 'Erdemin bütçesi yok',
      message:
        'Sağlık, öğrenme veya başkaları için harcama hiçbir yerde planlanmamış. Birini seçin ve ona ulaşmaktan memnun olacağınız bir sınır verin.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Zorunluluklar plandan pahalı',
      message:
        'Harcamaların %{{planned}} kadarını zorunluluklara ayırmıştınız; zorunluluklar %{{actual}} alıyor. Her birinin hâlâ bir ihtiyaç mı, yoksa sessizce bir konfora mı dönüştüğünü kontrol edin.',
    },
    {
      title: 'Zorunluluk %{{actual}}, plan %{{planned}}',
      message:
        'Hayatın gerektirdiği, genellikle alıştığımızdan azdır. En büyük zorunlu gideri taze bir gözle yeniden inceleyin.',
    },
    {
      title: 'Temel giderler şişiyor',
      message:
        'Zorunluluklar ayın %{{actual}} kadarını tutuyor; beklediğiniz oran %{{planned}} idi. Büyümeye devam eden bir ihtiyaç bir soruyu hak eder.',
    },
    {
      title: 'İhtiyaçlar planı aşıyor',
      message:
        'Planlanan %{{planned}}, gerçekleşen %{{actual}}. Ya plan gerçek maliyetleri küçümsedi ya da bazı istekler ihtiyaç adı altında dolaşıyor.',
    },
    {
      title: '“Mecburum” için niyetten fazlası',
      message:
        'Zorunluluklar harcamaların %{{planned}} yerine %{{actual}} kadarını aldı. Gerçekten gerekli olanı, yalnızca hep öyle olagelmiş olandan ayırın.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Zorunluluklar sinsice artıyor',
      message:
        'Zorunlu harcamalar {{months}} aydır üst üste artıyor, toplamda %{{percent}}. Kimse gerekçe sormadığında ihtiyaçlar sessizce büyür.',
    },
    {
      title: '{{months}} ayda zorunluluklarda +%{{percent}}',
      message:
        'Her adım küçük göründü; birlikte değiller. En büyük düzenli zorunlu gideri alın ve hâlâ bu kadar tutması gerekip gerekmediğini sorun.',
    },
    {
      title: 'Harcamalarınızın tabanı yükseliyor',
      message:
        'Zorunluluklar {{months}} ay art arda büyüdü (+%{{percent}}). Yükselen bir taban, özgürce seçtiğiniz her şeye daha az yer bırakır.',
    },
    {
      title: 'İhtiyaçlar genişliyor',
      message:
        '{{months}} aylık artış, toplamda %{{percent}}. Stoacı sınav basittir: bedelini bilerek bunu bugün yeniden seçer miydiniz?',
    },
    {
      title: 'Küçük artışlar, sabit yön',
      message:
        'Zorunluluklar {{months}} ayda %{{percent}} arttı. Yön, tek bir aydan daha önemlidir — bu yön erken düzeltilmeye değer.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'İş plandan pahalı',
      message:
        'Harcamaların %{{planned}} kadarını işe ayırmıştınız; iş %{{actual}} alıyor. Araçlar ve hizmetler yerlerini hak etmeli — hangilerinin hak ettiğini kontrol edin.',
    },
    {
      title: 'İş harcaması %{{actual}}, plan %{{planned}}',
      message:
        'İşinize yatırım, bir şey kazandırdığında iyidir. Ödediğiniz ama artık kullanmadığınız şeyleri gözden geçirin.',
    },
    {
      title: 'İş bütçesi zorlanıyor',
      message:
        'İş %{{planned}} yerine %{{actual}} aldı. Çalışkanlık işi iyi yapmaktır; onun için her aracı satın almak değil.',
    },
    {
      title: 'Araçlar planı aşıyor',
      message:
        'Planlanan %{{planned}}, işe harcanan %{{actual}}. Her gidere sorun: işimi yapmama yardım ediyor mu, yoksa yalnızca ilerleme gibi mi hissettiriyor?',
    },
    {
      title: 'İş maliyetleri kaydı',
      message:
        'İş harcamaların %{{actual}} kadarını tutuyor; niyet %{{planned}} idi. Şimdi yapılacak kısa bir denetim, sonra daha büyüğünden kurtarır.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}” yine sınırını aşıyor',
      message:
        '“{{category}}” son {{window}} ayın {{months}} ayında bütçeyi aştı. Ya sınır yanlış ya da arzu — hangisi olduğuna karar verin.',
    },
    {
      title: '“{{category}}”: {{window}} ayın {{months}} ayında bütçe aşımı',
      message:
        'Hep aşılan bir sınır sınır değil, yalnızca bir dilektir. Onu dürüst kılın — bilerek yükseltin ya da bilerek koruyun.',
    },
    {
      title: 'Aynı bütçe yine dayanamadı',
      message:
        '“{{category}}” {{window}} ay içinde {{months}} kez sınırını aştı. Tekrar bir bilgidir; onu kullanın.',
    },
    {
      title: '“{{category}}” dikkatinizi istiyor',
      message:
        '{{window}} ayın {{months}} ayında bütçe aşıldı. Satın almadan önceki ana bakın — alışkanlığın değişebileceği tek yer orasıdır.',
    },
    {
      title: '“{{category}}” kategorisinde bir örüntü',
      message:
        '{{window}} ayda {{months}} aşım. Neyi tekrarlarsak o oluruz; bu kategorinin sizin hakkınızda ne söylemesini istediğinize karar verin.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}” ayın {{day}}. gününde tükeniyor',
      message:
        '{{limitAmount}} tutarındaki sınırın {{spentAmount}} kadarını harcadınız ve bu hızla sınır ayın {{day}}. günü civarında bitiyor. Şimdi yavaşlamak, sonra durmaktan kolaydır.',
    },
    {
      title: '“{{category}}” ayın önünde gidiyor',
      message:
        '{{limitAmount}} sınırından şimdiden {{spentAmount}} gitti. Bu hızla ayın {{day}}. gününde tükenir — ayın geri kalanını hâlâ siz şekillendirebilirsiniz.',
    },
    {
      title: 'Hız kontrolü: “{{category}}”',
      message:
        'Mevcut hızla {{limitAmount}} tutarındaki bütçe yaklaşık ayın {{day}}. gününe kadar yeter. Öngörü, disiplinin en ucuz biçimidir.',
    },
    {
      title: '“{{category}}” geleceği harcıyor',
      message:
        '{{limitAmount}} sınırının {{spentAmount}} kadarı harcandı; sınır ayın {{day}}. günü dolaylarında bitiyor. Bu hafta yaptıklarınız bunun olup olmayacağını belirler.',
    },
    {
      title: '“{{category}}” için erken uyarı',
      message:
        'Mevcut hızla {{limitAmount}} tutarındaki sınır ay sonuna ulaşmayacak — ayın {{day}}. günü civarında tükeniyor. Maliyeti azken düzeltin.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}” kullanılmıyor',
      message:
        '“{{category}}” bütçesinde {{months}} aydır hiç harcama yok. Ya ona artık ihtiyacınız kalmadı ya da hâlâ bekleyen bir niyet — hangisi olduğuna karar verin.',
    },
    {
      title: 'Boş bir bütçe: “{{category}}”',
      message:
        'Tek bir harcama olmadan {{months}} ay. Plan, yaşadığınız hayatı ya da kurduğunuz hayatı anlatmalı — bu hangisi?',
    },
    {
      title: '“{{category}}” atıl duruyor',
      message:
        'Burada {{months}} aydır hiçbir şey harcanmadı. Ölçülülükse tebrikler; ihmalse harekete geçin.',
    },
    {
      title: 'Planlandı ama yaşanmadı',
      message:
        '“{{category}}” {{months}} aydır bir sınıra sahip ama harcaması yok. Planı dürüst tutun: ya kaldırın ya kullanın.',
    },
    {
      title: '“{{category}}”: {{months}} sessiz ay',
      message:
        'Hiç dokunulmayan bir bütçe de planınızda yer kaplar. Ya yeri boşaltın ya da niyete hakkını verin.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: 'Harcamaların %{{percent}} kadarının sınırı yok',
      message:
        'Ayın {{unbudgetedAmount}} tutarı, hiçbir bütçenin izlemediği kategorilere gitti. Bakmadığınız şeyi yargılayamazsınız.',
    },
    {
      title: 'Ayın büyük kısmı plansız',
      message:
        'Harcamaların %{{percent}} kadarı — {{unbudgetedAmount}} — tüm bütçelerin dışında. En büyük kısmına bir sınır koyun, plan hayatınızın daha fazlasını görsün.',
    },
    {
      title: 'Plan dışı harcamalar',
      message:
        'Bütçeler harcadıklarınızın yalnızca bir kısmını kapsıyor; {{unbudgetedAmount}} (%{{percent}}) ölçülmeden kalıyor. Planı paranın gerçekten gittiği yere genişletin.',
    },
    {
      title: 'Plan resmin yalnızca bir kısmını görüyor',
      message:
        'Ayın harcamalarının %{{percent}} kadarının bütçesi yok. Açık görmek, iyi yargılamadan önce gelir.',
    },
    {
      title: 'Sınırsız harcanan: {{unbudgetedAmount}}',
      message:
        'Bu, ayın %{{percent}} kadarı. Onu kısıtlamak zorunda değilsiniz — yalnızca gerçekte ne kadarını istediğinize karar verin.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: 'Eğlencenizin çoğu “{{category}}”',
      message:
        'Eğlence harcamalarının %{{percent}} kadarı “{{category}}” kategorisine gitti. Tadını çıkarın, ama vazgeçebileceğinizden emin olun.',
    },
    {
      title: 'Tek bir zevk baskın',
      message:
        '“{{category}}” eğlenceye harcadığınız her şeyin %{{percent}} kadarını alıyor. Hâlâ sizi sevindiriyor mu, yoksa rutine mi dönüştü, kendinize sorun.',
    },
    {
      title: 'Eğlence “{{category}}” kategorisine yaslanıyor',
      message:
        'Eğlencenin %{{percent}} kadarı tek bir yerde. Vazgeçemediğimiz şey üzerimizde güç sahibidir — tutuşun hâlâ hafif olduğunu kontrol edin.',
    },
    {
      title: '“{{category}}”: eğlencenin %{{percent}} kadarı',
      message:
        'Tek bir haz kaynağı neredeyse hepsini alıyor. Bir süre onsuz kalın ve size gerçekte ne verdiğine bakın.',
    },
    {
      title: 'Dinlenmenizin tek bir adresi var',
      message:
        'Eğlence parasının çoğu, %{{percent}}, “{{category}}” kategorisine gidiyor. Bir hazdan ancak onsuz yapabiliyorsanız özgürsünüz.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Harcamaların bir kısmı henüz tartılmadı',
      message:
        'Sınıfı olmayan kategori: {{count}}. Bütçeler bölümünde neyin zorunluluk, iş, erdem veya eğlence olduğuna karar verin.',
    },
    {
      title: 'Kararınızı bekleyen kategori: {{count}}',
      message:
        'Harcamaları var ama sınıfları yok, bu yüzden tavsiye onları tartamıyor. Bütçeler bölümünde bir dakika yeterli.',
    },
    {
      title: 'Paranızın neye hizmet ettiğini adlandırın',
      message:
        'Henüz sınıflandırılmamış kategori: {{count}}. Yargı, şeyleri doğru adlarıyla çağırmakla başlar.',
    },
    {
      title: 'Tartılmamış kategori: {{count}}',
      message:
        'Bir ihtiyaç mı, işiniz mi, bir erdem mi, yoksa bir zevk mi? Bunu yalnızca siz söyleyebilirsiniz — ve söylediğinizde plan netleşir.',
    },
    {
      title: 'Bazı kategorilerin sınıfı yok',
      message:
        'Dört sınıfın dışında kalan kategori: {{count}}. Her gider olduğu gibi görünsün diye onları Bütçeler bölümünde sınıflandırın.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Küçük alışverişler — {{merchant}}: {{count}}',
      message:
        'Her biri önemsiz görünüyordu; birlikte ay içinde {{totalAmount}} etti. Para en çok, sınanmamış küçük alışkanlıklarda sessizce gider.',
    },
    {
      title: '{{merchant}}: ayda {{count}} kez',
      message:
        'Küçük tutarlarla toplam {{totalAmount}}. Her ziyaretin bir seçim mi yoksa bir refleks mi olduğunu sorun: özgürlük yalnızca ilkidir.',
    },
    {
      title: 'Azar azar: {{totalAmount}}',
      message:
        '{{merchant}} alışverişleri: {{count}}. Tek tek hiçbiri önemli değil; alışkanlık önemli. Onu gerçekte ne sıklıkla istediğinize karar verin.',
    },
    {
      title: 'Bir alışkanlık: {{merchant}}',
      message:
        '{{count}} alışveriş, toplam {{totalAmount}}. Üçte birini atlamayı deneyin ve özleyip özlemediğinize bakın.',
    },
    {
      title: 'Küçük şeyler birikir',
      message:
        '{{merchant}} ziyareti: {{count}}, toplam {{totalAmount}}. Büyük kararlar üzerindeki hâkimiyet, bunlar gibi küçük kararlar üzerine kurulur.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Eğlencenin %{{percent}} kadarı hafta sonunda',
      message:
        'Eğlence harcamalarınızın çoğu cumartesi ve pazar günleri yapılıyor. Dinlenmek iyidir; bunun haftanın telafisi değil, gerçekten dinlenme olduğundan emin olun.',
    },
    {
      title: 'Eğlence hafta sonunda yaşıyor',
      message:
        'Eğlence harcamalarının %{{percent}} kadarı hafta sonlarına düşüyor. Hafta sonunu biraz planlayın; daha az tutar ve daha çok verir.',
    },
    {
      title: 'Hafta sonu haftanın bedelini ödüyor',
      message:
        'Hafta sonları, eğlenceye harcadıklarınızın %{{percent}} kadarını alıyor. Hafta her cumartesi onarılmak zorundaysa, haftaya bakın.',
    },
    {
      title: 'Cumartesi ve pazar: eğlencenin %{{percent}} kadarı',
      message:
        'Boş günler serbest harcamaya davet eder. Hafta sonunun ne için olduğuna önceden karar verin, para da onu izlesin.',
    },
    {
      title: 'Bir hafta sonu örüntüsü',
      message:
        'Eğlence harcamalarının %{{percent}} kadarı hafta sonlarında. Hafta içi biraz daha rahatlık, çoğu zaman hafta sonlarını daha ucuz kılar.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} ayın %{{percent}} kadarını aldı',
      message:
        'Eğlence için tek bir işletmeye {{totalAmount}} gitti. Bir yer paranızın bu kadarına sahipse, dikkatinizin ne kadarına sahip olduğunu da sorun.',
    },
    {
      title: 'Tek bir yer, {{totalAmount}}',
      message:
        '{{merchant}}, ayın harcamalarının %{{percent}} kadarı. Bu, hayat emeğinizin o kadarına değer mi?',
    },
    {
      title: 'Harcamalarınızın başında {{merchant}} var',
      message:
        'Ayın %{{percent}} kadarı — {{totalAmount}} — oraya gitti. Tekrar seçeceğiniz sürece bundan keyif almakta yanlış bir şey yok.',
    },
    {
      title: '{{merchant}} büyük bir pay aldı',
      message:
        '{{totalAmount}}, yani harcamaların %{{percent}} kadarı, tek bir eğlence yerinde. Zevki bedeliyle sakince tartın.',
    },
    {
      title: '%{{percent}} — {{merchant}}',
      message:
        'Bu tek işletme {{totalAmount}} aldı. Özgürlük, istediğinizde önünden geçip gidebilmektir.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Gelir düştü, harcama düşmedi',
      message:
        'Gelir %{{percent}} düşerek {{incomeAmount}} oldu, ama harcama {{expenseAmount}} düzeyinde kaldı. Talih fikrini değiştirdi; harcamalarınız henüz fark etmedi.',
    },
    {
      title: 'Gelir %{{percent}} azaldı',
      message:
        'Gelen {{incomeAmount}}, giden {{expenseAmount}}. Talih verdiğini geri alabilir — harcamayı olana göre ayarlayın, olmuş olana göre değil.',
    },
    {
      title: 'Daha zayıf bir ay, aynı alışkanlıklar',
      message:
        'Gelir %{{percent}} daha düşük ({{incomeAmount}}), harcama ise {{expenseAmount}} düzeyinde kaldı. Gelir sizin elinizde değil; tepkiniz öyle.',
    },
    {
      title: 'Talih yön değiştirdi',
      message:
        'Her zamankinden %{{percent}} daha az kazandınız, ama önceki gibi {{expenseAmount}} harcadınız. Bir zorunluluk değil de bir seçimken şimdi kısın.',
    },
    {
      title: 'Harcama geliri izlemedi',
      message:
        'Gelir {{incomeAmount}} düzeyine indi (%{{percent}} düşüş); harcama {{expenseAmount}}. Yelkeni gerçekte sahip olduğunuz rüzgâra göre ayarlayın.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonelikler: ayda {{monthlyAmount}}',
      message:
        'Abonelik sayısı: {{count}}; aylık harcamanızın %{{percent}} kadarını alıyorlar. Her biri size sormadan yenileniyor — her birini siz sorgulayın.',
    },
    {
      title: 'Harcamaların %{{percent}} kadarı kendiliğinden yenileniyor',
      message:
        'Abonelik: {{count}}, ayda {{monthlyAmount}}. Bugün yeniden abone olacaklarınızı tutun.',
    },
    {
      title: 'Sessiz, düzenli: {{monthlyAmount}}',
      message:
        'Abonelik: {{count}}; ayınızın %{{percent}} kadarına mal oluyor. Konfor iyi bir hizmetkâr, pahalı bir efendidir.',
    },
    {
      title: 'Gözden geçirilecek abonelik: {{count}}',
      message:
        'Hepsi birlikte ayda {{monthlyAmount}}, harcamaların %{{percent}} kadarı. Neredeyse hiç kullanmadığınız birini iptal edin ve onu ne kadar az özlediğinizi görün.',
    },
    {
      title: 'Kendiliğinden yenilenenler',
      message:
        'Abonelikler ({{count}}) ayda {{monthlyAmount}} tutuyor. Otomatik harcama, bilinçli bir gözden geçirmeyi hak eder.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Başarınız biraz daha uzağa ulaşabilir',
      message:
        '{{months}} ay boyunca gelirinizin %{{savingsPercent}} kadarını biriktirdiniz, ama neredeyse hiçbiri başkalarına gitmedi. Servet en çok açık ellerde yakışır — belki bu ay bir hediye ya da bağış?',
    },
    {
      title: 'İyi kazanıyor, az veriyorsunuz',
      message:
        'Son {{months}} ayda gelen tutar: {{incomeAmount}}, başkalarına giden: {{givenAmount}}. Uygulamanın göremediği yollarla yardım ediyorsanız bunu dikkate almayın; etmiyorsanız planda buna yer var.',
    },
    {
      title: 'Cömert olmak için iyi bir dönem',
      message:
        'Gelirinizin %{{savingsPercent}} kadarını biriktirdiniz — sağlam bir elin işareti. Bunun küçük bir payını ihtiyacı olan birine vermek, bu sağlamlığa daha fazla anlam katar.',
    },
    {
      title: 'Resimde henüz başka kimse yok',
      message:
        'Son {{months}} ay özenli bir kazanç ve birikim gösteriyor, ama hiç bağış ya da hediye yok. Birbirimiz için yaratıldık; başlamak için mütevazı bir hediye yeter.',
    },
    {
      title: 'İyiliğe yer var',
      message:
        'Gelen {{incomeAmount}} tutarının yalnızca {{givenAmount}} kadarı başkalarına yardıma gitti. Küçük ve düzenli bir bağışı düşünün — cömertlik, her erdem gibi, alışkanlıkla kolaylaşır.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}” hedefi geride kalıyor',
      message:
        'Ayda {{requiredAmount}} gerekiyor, siz yaklaşık {{paceAmount}} koyuyorsunuz. Bu tempoda hedef {{monthsLate}} ay geç varıyor. Tempo sizin elinizde.',
    },
    {
      title: '“{{goal}}”: bu hızla {{monthsLate}} ay gecikme',
      message:
        'Gereken aylık tutar {{requiredAmount}}, gerçekleşen yaklaşık {{paceAmount}}. Ya tarihi dürüstçe kaydırın ya da bilinçli olarak daha fazla para ayırın.',
    },
    {
      title: 'Hedef ve hız uyuşmuyor',
      message:
        '“{{goal}}” ayda {{requiredAmount}} istiyor; aldığı {{paceAmount}}. Bir hedef, ona doğru atılan aylık adım kadar gerçektir.',
    },
    {
      title: '“{{goal}}” daha sağlam bir adım istiyor',
      message:
        'Gereken {{requiredAmount}} tutarına karşı ayda {{paceAmount}}. Gelecek ay isteğe bağlı her şeyden önce hedefe ödeme yapın.',
    },
    {
      title: '“{{goal}}” hedefinde geridesiniz',
      message:
        'Mevcut tempo (ayda {{paceAmount}}) hedefi {{monthsLate}} ay geç bırakıyor. Sizin elinizde olan bütün yol değil, bir sonraki adımdır.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}” plana sığmıyor',
      message:
        'Ayda {{requiredAmount}} gerekiyor, ama bütçelerinizden sonra yalnızca {{freeAmount}} serbest kalıyor. Tarihi, hedef tutarı veya bütçeleri değiştirin — umut etmek plan değildir.',
    },
    {
      title: '“{{goal}}” serbest paranızdan fazlasını istiyor',
      message:
        'Her ay gereken: {{requiredAmount}}, mevcut: {{freeAmount}}. Her şeyi aynı anda istemek, hiçbir şeyin yapılamamasının yoludur; seçin.',
    },
    {
      title: 'Rakamlar şimdilik hayır diyor',
      message:
        '“{{goal}}” ayda {{requiredAmount}} gerektiriyor; serbest nakdiniz {{freeAmount}}. Elinizde olanı ayarlayın: son tarihi ya da diğer sınırları.',
    },
    {
      title: '“{{goal}}” bir karar bekliyor',
      message:
        'Ayda {{requiredAmount}} ile, bütçelerden sonra kalan {{freeAmount}} tutarını aşıyor. Gözler açıkken seçilmiş bir hedef, hayallerle ayakta tutulan bir hedeften iyidir.',
    },
    {
      title: '“{{goal}}” için imkânsız bir hız',
      message:
        'Aylık gereken {{requiredAmount}}, serbest {{freeAmount}}. Bugün dürüst bir hesap, yarın bir hayal kırıklığından korur.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Bakiyeniz {{date}} tarihinde sıfırın altına iniyor',
      message:
        'Gelir ve harcamalar şimdiki gidişle sürerse öngörülen bakiye {{lowestAmount}} düzeyine iniyor. Henüz yalnızca bir tahminken şimdi hazırlanın.',
    },
    {
      title: 'Yaklaşan açık: {{date}}',
      message:
        'Ödemeler ve günlük harcamalar gelenin önüne geçiyor, en düşük nokta {{lowestAmount}}. Sıkıntıyı önceden düşünmek, onun gücünü alır.',
    },
    {
      title: '{{date}} için plan yapın',
      message:
        'O gün tahmini bakiye {{lowestAmount}} düzeyine iniyor. Bir ödemeyi kaydırın, bir isteği erteleyin ya da nakit ayırın — bunların her biri bugün sizin elinizde.',
    },
    {
      title: 'Tahmin sıfırın altına düşüyor',
      message:
        'Bakiye {{date}} dolaylarında {{lowestAmount}} düzeyine düşüyor. Sakin yanıt, erken yanıttır.',
    },
    {
      title: '{{date}} tarihindeki açığı önceden görün',
      message:
        'Tahmini en düşük bakiye: {{lowestAmount}}. Öngörülen şey soğukkanlılıkla karşılanabilir; bizi şaşırtan ise nadiren.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Kendinize verdiğiniz sözü tuttunuz',
      message:
        '{{months}} aydır üst üste harcamalarınız kendi belirlediğiniz planın içinde kaldı. Kendine hâkim olmak böyle görünür.',
    },
    {
      title: '{{months}} aydır plan dahilinde',
      message:
        'Ay be ay niyet ettiğiniz ile yaptığınız örtüşüyor. İstikrar, iradeden daha sessizdir ve daha uzun sürer.',
    },
    {
      title: 'Plan ve hayat uyum içinde',
      message:
        'Art arda {{months}} ay sınırlarınız içinde. Bu kadar iyi tutulan bir plan artık bir kısıtlama değil — yaşama biçiminiz.',
    },
    {
      title: '{{months}} aydır istikrarlı',
      message: 'Bütçeleriniz {{months}} aydır dayanıyor. Aynı dikkati sürdürün; işe yarıyor.',
    },
    {
      title: 'Sürdürülen disiplin',
      message:
        'Planınızı bozmadan {{months}} ay. Kendi kararlarınıza güvenmek kadar özgürleştirici az şey vardır.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Paranız değerlerinizi izliyor',
      message:
        'Erdeme hizmet eden para harcamalarınızın %{{actual}} kadarı oldu, planladığınız %{{planned}} düzeyinden aşağı değil. İyi harcanmış.',
    },
    {
      title: 'Erdem tam payını aldı',
      message:
        'Sağlık, öğrenme ve başkaları için %{{actual}}; planlanan %{{planned}}. Değer verdiğiniz şeyin bedelini ödediniz.',
    },
    {
      title: 'Daha iyi olmak için harcandı',
      message:
        'Sağlık, öğrenme ve benzerlerine ayın harcamalarının %{{actual}} kadarı gitti (plan %{{planned}}). Erdem satın alınamaz, ama ona hizmet edilebilir.',
    },
    {
      title: 'Niyet yerine getirildi',
      message:
        'Erdem için %{{planned}} planladınız ve %{{actual}} harcadınız. İyi niyetler nadiren bir ay dayanır — sizinki dayandı.',
    },
    {
      title: 'Paranın en iyi kullanımı',
      message:
        '%{{actual}} kadarı sizi ve başkalarını daha iyi yapan şeylere gitti. Onu seçmeye devam edin.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Eğlence yerinde',
      message:
        'Eğlence harcamaların %{{actual}} kadarı; ona ayırdığınız %{{planned}} sınırının altında. Şeylerin tadını onlara boyun eğmeden çıkarıyorsunuz.',
    },
    {
      title: 'Ölçüsünde zevk',
      message:
        'Eğlence %{{actual}} aldı, plan %{{planned}} idi. Ölçülülük bir şeyleri kaçırmak değil, seçmektir.',
    },
    {
      title: 'Aşırılıksız dinlenme',
      message:
        'Eğlenceye %{{actual}}; %{{planned}} sınırınızın altında. Keyif, kumandayı elinde tutmadığında daha lezzetlidir.',
    },
    {
      title: 'Sessizce ölçülülük',
      message:
        'Eğlenceye %{{planned}} verdiniz, yalnızca %{{actual}} kullandı. O pay, koruduğunuz özgürlüktür.',
    },
    {
      title: 'Eğlence planın altında',
      message:
        'Harcamaların %{{actual}} kadarıyla eğlence, belirlediğiniz %{{planned}} oranının altında kaldı. İyi tutuldu.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: 'Planın %{{percent}} altında',
      message:
        'Ay için kendinize izin verdiğinizden {{savedAmount}} az harcadınız. Elinizde olabilecek her şeye ihtiyaç duymamak bir zenginliktir.',
    },
    {
      title: 'Harcanmadan kalan: {{savedAmount}}',
      message:
        'Ay planın %{{percent}} altında kapandı. Harcamadığınız parayı yönlendirmek hâlâ sizin elinizde.',
    },
    {
      title: 'İzin verdiğinizden az',
      message:
        'Harcamalar planın %{{percent}} altında — {{savedAmount}} korundu. Alışkanlık sahiplenmeden önce o paya bir amaç verin.',
    },
    {
      title: 'Planda boş yer kaldı',
      message:
        'Ay için sınırlarınızın {{savedAmount}} altındasınız. Kolay gelen ölçülülük, kalıcı olandır.',
    },
    {
      title: 'Plandan daha hafif bir ay',
      message:
        'Bütçelediğinizden %{{percent}} daha azına ihtiyaç duydunuz. {{savedAmount}} tutarını bir hedefe yönlendirmeyi düşünün.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}” takvimde',
      message:
        'Yolun %{{percent}} kadarını, hedefin gerektirdiği hızla aldınız. Her ay atılan istikrarlı adımlar uzağa götürür.',
    },
    {
      title: '“{{goal}}” için doğru yoldasınız',
      message:
        '%{{percent}} tamamlandı ve hız korunuyor. Önce hedefe ödemeye devam edin; işe yarıyor.',
    },
    {
      title: '“{{goal}}”: %{{percent}} ve istikrarlı',
      message: 'Hedef her ay ihtiyacı olanı alıyor. Sabır işini yapıyor.',
    },
    {
      title: 'Hedef planlandığı gibi ilerliyor',
      message:
        '“{{goal}}” hedefinin %{{percent}} kadarı finanse edildi ve zamanında. Her ay biraz yapılan şeyi tek bir kötü hafta durduramaz.',
    },
    {
      title: 'Güvenilir ilerleme',
      message:
        '“{{goal}}” hedefi %{{percent}} düzeyinde, takvimde. Onu işe yarayan tek yolla inşa ediyorsunuz — adım adım.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: '{{merchant}} için daha az dürtüsel alışveriş',
      message:
        'Ayda {{before}} alışverişten yaklaşık {{after}} alışverişe. Gevşeyen alışkanlık kazanılmış özgürlüktür.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Eskisinden daha az gidiyorsunuz. Atlanan her refleks, seçimin alışkanlığa karşı küçük bir zaferidir.',
    },
    {
      title: 'Küçük alışkanlık küçülüyor',
      message:
        '{{merchant}} alışverişleri azaldı: önce {{before}}, şimdi yaklaşık {{after}}. Devam edin — giderek kolaylaşır.',
    },
    {
      title: 'Refleks yerine seçim',
      message:
        '{{merchant}} alışverişlerinde önce {{before}}, şimdi yaklaşık {{after}}. Bu, her seferinde bir kararla kurulan hâkimiyettir.',
    },
    {
      title: 'Küçük şeylerden daha az',
      message:
        '{{merchant}} ziyareti: {{before}} yerine yaklaşık {{after}}. Küçük zaferler birikir.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Daha zayıf bir aya uyum sağladınız',
      message:
        'Gelir %{{incomePercent}} düştü, siz de harcamayı %{{expensePercent}} azalttınız. Talihin değişimine rota değişimiyle karşılık verdiniz.',
    },
    {
      title: 'Gelir düştüğünde soğukkanlılık',
      message:
        'Gelir %{{incomePercent}} aşağıda, harcama %{{expensePercent}} aşağıda. Olmuş olana değil, olana uyum sağladınız.',
    },
    {
      title: 'Talih değişti; siz de',
      message:
        'Gelirdeki %{{incomePercent}} düşüş, harcamada %{{expensePercent}} düşüşle karşılandı. Rakamlarla ifade edilmiş dinginlik budur.',
    },
    {
      title: 'İyi dümen',
      message:
        'Gelir %{{incomePercent}} düştüğünde harcama da onu izledi (%{{expensePercent}} daha az). Rüzgâr sizin değildi; yelken sizindi.',
    },
    {
      title: 'Harcama geliri aşağı doğru izledi',
      message:
        'Gelir %{{incomePercent}} düşerken %{{expensePercent}} daha az harcadınız. Erken uyum sağlamak, sakin geçiş yoludur.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Zorunluluklar istikrarlı',
      message:
        '{{months}} aydır temel giderleriniz neredeyse hiç değişmedi. Sağlam bir taban, üstünde size özgürlük verir.',
    },
    {
      title: 'İhtiyaçlar kontrol altında',
      message:
        'Zorunlu harcamalar {{months}} aydır sabit. Büyümeyen ihtiyaçlar, sizin yönettiğiniz ihtiyaçlardır.',
    },
    {
      title: '{{months}} ay boyunca sabit temel giderler',
      message: 'Kira, yiyecek ve faturalar olduğu yerde kaldı. Sessiz istikrar da bir başarıdır.',
    },
    {
      title: 'Zorunluluklarda sinsi artış yok',
      message:
        'Hayatın gerektirdiklerinde {{months}} ay boyunca kayma yok. Her şeyi bu zemin üzerinde planlamak daha kolaydır.',
    },
    {
      title: 'Sağlam bir taban',
      message:
        'Temel harcamalar {{months}} aydır istikrarlı. Konforların ihtiyaç kılığına girmesine izin vermiyorsunuz.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Kazandığınızla cömertsiniz',
      message:
        '{{months}} ay boyunca gelirinizin %{{percent}} kadarı — {{givenAmount}} — başkalarına yardıma gitti. Bu, paranın en iyi kullanımıdır.',
    },
    {
      title: 'Başkalarına verilen: {{givenAmount}}',
      message:
        '{{months}} ay içinde gelirinizin %{{percent}} kadarını paylaştınız. Rakamlarda görünen iyilik, yalnızca hissedilen değil, uygulanan iyiliktir.',
    },
    {
      title: 'Açık eller',
      message:
        'Son dönemde bağışlar ve hediyeler gelirinizin %{{percent}} kadarını oluşturdu. Verdiğiniz şey, servetinizin hiçbir talihsizliğin alamayacağı kısmıdır.',
    },
    {
      title: 'Cömertlik planınızın bir parçası',
      message:
        '{{months}} ay içinde başkalarına verilen: {{givenAmount}}. Böyle sürdürün — başkalarına yaptığınız iyilik, kendinize de yapılmış bir iyiliktir.',
    },
    {
      title: 'Yerinde verilmiş',
      message:
        'Kazandığınızın %{{percent}} kadarı başkalarına yardıma gitti. Bir insan hakkında bundan fazlasını söyleyen alışkanlık azdır.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Düzeltilecek bir şey yok',
      message: 'Harcamalarınız niyet ettiğinizle örtüşüyor. Böyle devam edin.',
    },
    {
      title: 'Niyet ve eylem örtüşüyor',
      message: 'Ay, planladığınız gibi görünüyor. Bu uyum her şeyin özüdür.',
    },
    {
      title: 'Sakin bir ay',
      message: 'Söz etmeye değer ne aşırılık ne ihmal var. Tebrikler — aynı dikkati sürdürün.',
    },
    {
      title: 'Her şey yolunda',
      message:
        'Planınız dayandı ve hiçbir şey düzeltme istemiyor. Hak ettiğiniz huzurun tadını çıkarın.',
    },
    {
      title: 'Sağlam el',
      message: 'Ay planınızı izledi. İyi alışkanlıklar iyi ayları sıradan gösterir.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Önce kendi payınızı ayırın',
      message:
        '{{months}} ayda gelirinizin %{{savingsPercent}} kadarını elinizde tuttunuz. Seneca’nın uyarısı: fıçının dibine gelince tasarruf etmek için artık geçtir. Para elinize geçtiği gün {{tenthAmount}} kenara koyun.',
    },
    {
      title: 'Fıçının üstünde tasarruf edin',
      message:
        'Gelirinizin yalnızca %{{savingsPercent}} kadarı size kaldı. Artanı bekleyen tasarruf geç gelir; ayda {{tenthAmount}}, önce ayrılırsa, işe şimdi başlar.',
    },
    {
      title: 'Gerçekten sizin olanı koruyun',
      message:
        'Seneca, gerçekten size ait olanı korumayı ve erken başlamayı öğütler. Son zamanlarda gelirinizin %{{savingsPercent}} kadarı size kaldı; maaş gününde {{tenthAmount}} ile başlayın, harcamalar geri kalana göre şekillensin.',
    },
    {
      title: 'Telve kalmadan başlayın',
      message:
        '{{months}} ayda %{{savingsPercent}} biriktirdiniz. Biriktirmek ancak biriktirecek bir şey kaldıkça sizin elinizdedir: her şeyden önce {{tenthAmount}} kenara ayırın.',
    },
    {
      title: '%{{savingsPercent}} kaldı, fıçı boşalıyor',
      message:
        'Ayda {{tenthAmount}}, gelirin onda biri, hiçbir fatura ödenmeden önce ayrılır. İlk koruduğunuz şey, ayın geriye ne bırakacağına bağlı değildir.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Her şey sakinken hazırlanın',
      message:
        'Yedeğiniz yaklaşık {{cushionDays}} günlük harcamayı karşılıyor. Seneca: ruh, tasasız zamanlarda kendini sertleştirmelidir. Üç aylık harcama {{targetAmount}} eder.',
    },
    {
      title: '{{cushionDays}} günlük bir yedek',
      message:
        'Talih kendini önceden duyurmaz. Acele eden bir şey yokken {{targetAmount}} hedefine, yani üç aylık harcamaya doğru ilerleyin: kolay olan zaman budur.',
    },
    {
      title: '“Korktuğum durum bu muydu?”',
      message:
        'Seneca, yoksulluğun dehşeti geçsin diye Lucilius’a onu denetirdi. {{cushionDays}} günlük yedekle zor bir ay bir deneme bile olmazdı. {{targetAmount}} hedefleyin.',
    },
    {
      title: 'Zor ayı önceden görün',
      message:
        'Birikiminiz yaklaşık {{cushionDays}} gün yeter. Önceden görülen şey yumuşak gelir; {{targetAmount}} sizi üç ay taşırdı.',
    },
    {
      title: 'Fırtınadan önce duvarı örün',
      message:
        'Yaklaşık {{cushionDays}} gün karşılanıyor. Gelirin kesilmesi sizin elinizde değil; yedek ise sizin elinizde. Üç aylık harcama {{targetAmount}} tutar.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'İstekler gelirin önüne geçiyor',
      message:
        'Son çeyrekte harcamalar %{{expenseGrowth}} arttı, gelir ise %{{incomeGrowth}} değişti. Seneca yazar: yoksul olan, çok azı olan değil, daha fazlasını arzulayandır.',
    },
    {
      title: 'Daha yüksekte yaşamak, daha iyi değil',
      message:
        'Harcamalar %{{expenseGrowth}}, gelir %{{incomeGrowth}} büyüdü. Doğanın ihtiyaçları azdır; kanaatin istekleri sınırsızdır. Artışın bunlardan hangisine hizmet ettiğini sorun.',
    },
    {
      title: 'İstekler büyüdü: +%{{expenseGrowth}}',
      message:
        'Giderler gelirden ({{incomeGrowth}}%) hızlı yükseldi. Yeni bir rahatlık çabucak ihtiyaç gibi görünür: henüz reddedebiliyorken fark edin.',
    },
    {
      title: 'Hedef çizgisi kayıyor',
      message:
        'Harcamalar çeyrekten çeyreğe %{{expenseGrowth}} arttı, gelir ise %{{incomeGrowth}}. Yeter, ancak neyin yettiğine siz karar verirseniz yeter olarak kalır.',
    },
    {
      title: 'Daha fazlası çare değil',
      message:
        'Son çeyrekte harcamalar %{{expenseGrowth}}, gelir %{{incomeGrowth}} büyüdü. Arzuyla birlikte büyüyen zenginlik hiçbir zaman gelmez; bu yeni normal olmadan önce sınırı belirleyin.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}}: hayatınızdan {{hours}} saat',
      message:
        'Seneca, gerçekten bizim olanın yalnızca zaman olduğunu hatırlatır. {{merchant}} alışverişindeki {{totalAmount}}, emeğinizin yaklaşık {{hours}} saatine denk. Buna değdi mi?',
    },
    {
      title: '{{merchant}}: {{hours}} saat',
      message:
        'Parayı korur, zamanı ortalığa saçarız. Ortalama saatlik gelirinizle oradaki {{totalAmount}} kabaca {{hours}} çalışma saati eder.',
    },
    {
      title: 'Fiyatı saatle ölçün',
      message:
        '{{merchant}} alışverişindeki {{totalAmount}} yaklaşık {{hours}} saatlik çalışmadır. Saatler, geri kazanamayacağınız tek şeydir.',
    },
    {
      title: '{{merchant}} gerçekte neye mal oldu',
      message:
        'Günlerinizi paraya, parayı eşyaya çeviriyorsunuz. {{merchant}} sizden yaklaşık {{hours}} saat aldı ({{totalAmount}}). Haz, o saatlerle denk mi?',
    },
    {
      title: 'Saatleri tartın',
      message:
        'Ortalama saatlik gelirinizle çevrildiğinde {{merchant}} alışverişindeki {{totalAmount}} yaklaşık {{hours}} saat eder. Zamanımızın büyük kısmını yitiriyoruz, diye yazar Seneca. Bunu siz mi seçtiniz?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: '“{{rule}}” kuralı yolunu şaşırdı',
      message:
        'Artık var olmayan bir şeyi gösteriyor, bu yüzden sessizce çalışmayı bıraktı. Onarın ya da kaldırın: hiçbir şey yapmayan düzen yalnızca düzen gibi görünür.',
    },
    {
      title: '“{{rule}}” artık işlemiyor',
      message:
        'Kategorisi, hesabı ya da alıcısı yok oldu; kural her işlemde atlanıyor. Şeyleri olduğu gibi görün, sonra düzeltin.',
    },
    {
      title: 'Hiçbir yeri göstermeyen bir kural',
      message:
        '“{{rule}}” işlemleri silinmiş bir yere gönderiyor. Bir zamanlar bir karar verdiniz; şimdi her şey değiştiğine göre yeniden karar verin.',
    },
    {
      title: '“{{rule}}” sizin muhakemenize muhtaç',
      message:
        'Atıfta bulunduğu şey silindi, eskiden onun sınıflandırdığı işlemler artık sizi bekliyor. Ona yeni bir hedef verin ya da bırakın gitsin.',
    },
    {
      title: 'Sessizce bozulmuş bir kural',
      message:
        '“{{rule}}” hiçbir şey yapmıyor ve bunu söylemiyor. Elinizdekini onarın: bir dakikanızı alır.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Eliniz “{{rule}}” ile aynı fikirde değil',
      message:
        'Bu kuralın başka yere koyduğunu {{count}} kez elle sınıflandırdınız. Ya kural yanlış ya el: hangisi olduğuna karar verin.',
    },
    {
      title: '“{{rule}}” {{count}} kez geçersiz kılındı',
      message:
        'Sürekli düzelttiğiniz kural artık bir karar değil, kendinizle tartışma alışkanlığıdır. Ya değiştirin ya da güvenin.',
    },
    {
      title: 'Ne yapıyorsanız onu söyleyin, ne söylediyseniz onu yapın',
      message:
        '“{{rule}}” kuralı bir şey söylüyor; son {{count}} düzeltmeniz başka bir şey. İkisini uzlaştırın.',
    },
    {
      title: 'Tartışmalı bir karar',
      message:
        '“{{rule}}” kuralını sakin bir kafayla koydunuz; o günden beri {{count}} işlem başka yöne gitti. Aranızdan hangisinin haklı olduğuna sakin sakin bir daha bakın.',
    },
    {
      title: '“{{rule}}” aleyhine {{count}} düzeltme',
      message: 'Tekrar bir bilgidir. Kuralı değiştirsin ya da kural alışkanlığı değiştirsin.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: '{{payee}} için bir kez karar verin',
      message:
        '{{payee}} alıcısını {{decided}} kez elle sınıflandırdınız, hep aynı şekilde. Tekrar tekrar karar verdiğiniz şeye sakin kafayla bir kez karar verin.',
    },
    {
      title: '{{decided}} kez verilmiş bir karar',
      message:
        '{{payee}} hep aynı soruyu soruyor, siz hep aynı yanıtı veriyorsunuz. Bir kural, dikkatinizi gerçekten gerektiren şeylere saklar.',
    },
    {
      title: 'Kurala hazır alıcılar: {{count}}',
      message:
        'Aynı alıcılara hep aynı kategoriyi veriyorsunuz, en çok da {{payee}} için. Muhakemenizi yeni olana saklayın.',
    },
    {
      title: 'Alışkanlığınız ilkeye dönüşmeye hazır',
      message:
        '{{payee}} alıcısını her seferinde aynı şekilde sınıflandırıyorsunuz (şimdiye kadar {{decided}}). Bunu kural olarak yazın, çaba harcamadan sürsün.',
    },
    {
      title: 'Bunu bir kural taşısın',
      message:
        'Her seferinde aynı şekilde sınıflandırdığınız alıcılar: {{count}}; en başta {{payee}}, {{decided}} işlemle. Bir kez konmuş ilke yeniden tartışılmak zorunda değildir.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” {{months}} aydır hiçbir şeye rastlamadı',
      message:
        'Ya kuralın yapıldığı dünya gitti ya da koşulları hedefi ıskalıyor. Kurallarınızı doğru tutun: onarın ya da kaldırın.',
    },
    {
      title: 'Dinlenen bir kural: “{{rule}}”',
      message:
        '{{months}} aydır tek bir işleme dokunmadı. Fazlalığı atın; geriye kalana güvenmek daha kolay olur.',
    },
    {
      title: '“{{rule}}” boşta duruyor',
      message:
        'Yeni işlemler gelmeye devam ederken {{months}} aydır eşleşme yok. Son işlemlerinizde deneyin, sonra karar verin.',
    },
    {
      title: '“{{rule}}” hâlâ gerekli mi?',
      message:
        '{{months}} aydır hiçbir şey onunla eşleşmedi. Alışkanlıktan tutulan bir kural, bakılması gereken bir şey daha demektir.',
    },
    {
      title: 'Karar verecek bir şeyi olmayan bir karar',
      message:
        '“{{rule}}” {{months}} aydır sessiz. Düzen, ihtiyaç duyduğunuza sahip olmaktır, yalnızca ona.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Kararlarınız ayakta',
      message:
        'Kurallar ayın işlemlerinin %{{percent}} kadarını sınıflandırdı ve hiçbirini bozmanız gerekmedi. Bir kez verilip korunan karar zihni özgürleştirir.',
    },
    {
      title: '%{{percent}} önceden halledildi',
      message:
        'Ayın işlemlerinin çoğu daha önce karar verdiğiniz şeye göre sınıflandı. Bu, önemli olana saklanmış dikkattir.',
    },
    {
      title: 'İş başındaki ilkeler',
      message:
        'Kurallarınız işlemlerin %{{percent}} kadarını tartışmasız ele aldı. Yerleşmiş ilkeler sakin günler getirir.',
    },
    {
      title: 'Karar verilecek şey azaldı',
      message:
        'İşlemlerin %{{percent}} kadarı yeni bir karar gerektirmedi. Bir kez, iyi yargıladınız ve yargı hâlâ geçerli.',
    },
    {
      title: 'Düzen korundu',
      message:
        'Kurallar ayın %{{percent}} kadarını sınıflandırdı ve hiçbiri çürütülmedi. İyi düzen, hiçbir şey olmuyormuş gibi görünür.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” hedefinin tarihi yok',
      message:
        '%{{percent}} düzeyinde ve içeri hiçbir şey girmiyor. Hangi limana yol aldığını bilmeyen için hiçbir rüzgâr uygun değildir: varmak istediğiniz günü belirleyin.',
    },
    {
      title: 'Bir dilek mi, bir hedef mi?',
      message:
        '“{{goal}}” hedefinin ne bitiş tarihi ne de temposu var. Hedef, tarihi olan bir karardır; ona bir tarih verin ya da bırakın gitsin.',
    },
    {
      title: '“{{goal}}” için bir gün belirleyin',
      message:
        'Yolun %{{percent}} kadarında ve kımıldamıyor. Her zaman yapılabilen şey nadiren yapılır.',
    },
    {
      title: '“{{goal}}” bir “bir gün”ü bekliyor',
      message:
        'Son zamanlarda içine hiçbir şey girmedi ve hiçbir tarih bir şey istemiyor. “Bir gün” takviminizde yok; takviminizde olan bir gün seçin.',
    },
    {
      title: '“{{goal}}” hedefinin limanı yok',
      message:
        '%{{percent}} düzeyinde, bitiş tarihi olmadan. Nereye yelken açtığınızı bilin, aylık adım arkasından gelir.',
    },
  ],
};
