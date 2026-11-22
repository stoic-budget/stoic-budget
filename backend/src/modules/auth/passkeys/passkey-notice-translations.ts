/**
 * The passkey notice mail, in every interface language. `{{app}}` is APP_NAME,
 * `{{when}}` the time in their own zone and `{{url}}` Settings > Security >
 * Passkeys. The greeting names nobody: the account name can be changed without
 * the password, so it must not put words into a security notice.
 */
export interface PasskeyNoticeText {
  greeting: string;
  addedSubject: string;
  addedNote: string;
  removedSubject: string;
  removedSubjectMany: string;
  synced: string;
  deviceOnly: string;
  when: string;
  review: string;
  notYouAdded: string;
  notYouRemoved: string;
}

const en: PasskeyNoticeText = {
  greeting: 'Hello,',
  addedSubject: 'A passkey was added to your {{app}} account',
  addedNote: 'Whoever has this passkey can sign in to your account without the password.',
  removedSubject: 'A passkey was removed from your {{app}} account',
  removedSubjectMany: 'Passkeys were removed from your {{app}} account',
  synced: 'synced across devices',
  deviceOnly: 'kept on one device only',
  when: 'When: {{when}}',
  review: 'Review your passkeys in Settings > Security > Passkeys: {{url}}',
  notYouAdded: 'Not you? Remove it there and reset your password.',
  notYouRemoved: 'Not you? Reset your password and check your passkeys there.',
};

const ru: PasskeyNoticeText = {
  greeting: 'Здравствуйте!',
  addedSubject: 'К вашему аккаунту {{app}} добавлен ключ доступа',
  addedNote: 'Тот, у кого есть этот ключ, может войти в ваш аккаунт без пароля.',
  removedSubject: 'Из вашего аккаунта {{app}} удалён ключ доступа',
  removedSubjectMany: 'Из вашего аккаунта {{app}} удалены ключи доступа',
  synced: 'синхронизируется между устройствами',
  deviceOnly: 'хранится только на одном устройстве',
  when: 'Когда: {{when}}',
  review: 'Проверьте ключи в разделе «Настройки > Безопасность > Ключи доступа»: {{url}}',
  notYouAdded: 'Это были не вы? Удалите ключ там и смените пароль через сброс.',
  notYouRemoved: 'Это были не вы? Смените пароль через сброс и проверьте там свои ключи.',
};

const kk: PasskeyNoticeText = {
  greeting: 'Сәлеметсіз бе!',
  addedSubject: '{{app}} аккаунтыңызға кіру кілті қосылды',
  addedNote: 'Бұл кілт кімде болса, сол аккаунтыңызға құпия сөзсіз кіре алады.',
  removedSubject: '{{app}} аккаунтыңыздан кіру кілті жойылды',
  removedSubjectMany: '{{app}} аккаунтыңыздан кіру кілттері жойылды',
  synced: 'құрылғылар арасында синхрондалады',
  deviceOnly: 'тек бір құрылғыда сақталады',
  when: 'Қашан: {{when}}',
  review: 'Кілттерді «Баптаулар > Қауіпсіздік > Кіру кілттері» бөлімінде тексеріңіз: {{url}}',
  notYouAdded: 'Бұл сіз емес пе? Кілтті сол жерден жойып, құпия сөзді қалпына келтіріңіз.',
  notYouRemoved: 'Бұл сіз емес пе? Құпия сөзді қалпына келтіріп, сол жерден кілттерді тексеріңіз.',
};

const de: PasskeyNoticeText = {
  greeting: 'Hallo,',
  addedSubject: 'Ihrem {{app}}-Konto wurde ein Passkey hinzugefügt',
  addedNote: 'Wer diesen Passkey besitzt, kann sich ohne Passwort bei Ihrem Konto anmelden.',
  removedSubject: 'Aus Ihrem {{app}}-Konto wurde ein Passkey entfernt',
  removedSubjectMany: 'Aus Ihrem {{app}}-Konto wurden Passkeys entfernt',
  synced: 'über Geräte synchronisiert',
  deviceOnly: 'nur auf einem Gerät gespeichert',
  when: 'Wann: {{when}}',
  review: 'Prüfen Sie Ihre Passkeys unter Einstellungen > Sicherheit > Passkeys: {{url}}',
  notYouAdded: 'Nicht Sie? Entfernen Sie ihn dort und setzen Sie Ihr Passwort zurück.',
  notYouRemoved: 'Nicht Sie? Setzen Sie Ihr Passwort zurück und prüfen Sie dort Ihre Passkeys.',
};

const fr: PasskeyNoticeText = {
  greeting: 'Bonjour,',
  addedSubject: "Une clé d'accès a été ajoutée à votre compte {{app}}",
  addedNote: 'Quiconque possède cette clé peut se connecter à votre compte sans le mot de passe.',
  removedSubject: "Une clé d'accès a été supprimée de votre compte {{app}}",
  removedSubjectMany: "Des clés d'accès ont été supprimées de votre compte {{app}}",
  synced: 'synchronisée entre appareils',
  deviceOnly: 'conservée sur un seul appareil',
  when: 'Quand : {{when}}',
  review: "Vérifiez vos clés dans Paramètres > Sécurité > Clés d'accès : {{url}}",
  notYouAdded: "Ce n'était pas vous ? Supprimez-la et réinitialisez votre mot de passe.",
  notYouRemoved: "Ce n'était pas vous ? Réinitialisez votre mot de passe et vérifiez vos clés.",
};

const es: PasskeyNoticeText = {
  greeting: 'Hola:',
  addedSubject: 'Se añadió una llave de acceso a tu cuenta de {{app}}',
  addedNote: 'Quien tenga esta llave puede entrar en tu cuenta sin la contraseña.',
  removedSubject: 'Se eliminó una llave de acceso de tu cuenta de {{app}}',
  removedSubjectMany: 'Se eliminaron llaves de acceso de tu cuenta de {{app}}',
  synced: 'sincronizada entre dispositivos',
  deviceOnly: 'guardada en un solo dispositivo',
  when: 'Cuándo: {{when}}',
  review: 'Revisa tus llaves en Ajustes > Seguridad > Llaves de acceso: {{url}}',
  notYouAdded: '¿No fuiste tú? Elimínala allí y restablece tu contraseña.',
  notYouRemoved: '¿No fuiste tú? Restablece tu contraseña y revisa allí tus llaves.',
};

const pt: PasskeyNoticeText = {
  greeting: 'Olá,',
  addedSubject: 'Uma chave de acesso foi adicionada à sua conta {{app}}',
  addedNote: 'Quem tiver esta chave pode entrar na sua conta sem a senha.',
  removedSubject: 'Uma chave de acesso foi removida da sua conta {{app}}',
  removedSubjectMany: 'Chaves de acesso foram removidas da sua conta {{app}}',
  synced: 'sincronizada entre dispositivos',
  deviceOnly: 'guardada em um único dispositivo',
  when: 'Quando: {{when}}',
  review: 'Revise suas chaves em Configurações > Segurança > Chaves de acesso: {{url}}',
  notYouAdded: 'Não foi você? Remova-a lá e redefina sua senha.',
  notYouRemoved: 'Não foi você? Redefina sua senha e confira suas chaves lá.',
};

const tr: PasskeyNoticeText = {
  greeting: 'Merhaba,',
  addedSubject: '{{app}} hesabınıza bir geçiş anahtarı eklendi',
  addedNote: 'Bu anahtara sahip olan herkes hesabınıza parola olmadan girebilir.',
  removedSubject: '{{app}} hesabınızdan bir geçiş anahtarı kaldırıldı',
  removedSubjectMany: '{{app}} hesabınızdan geçiş anahtarları kaldırıldı',
  synced: 'cihazlar arasında eşitlenir',
  deviceOnly: 'yalnızca tek bir cihazda tutulur',
  when: 'Ne zaman: {{when}}',
  review: 'Anahtarlarınızı Ayarlar > Güvenlik > Geçiş anahtarları bölümünde inceleyin: {{url}}',
  notYouAdded: 'Siz değil miydiniz? Anahtarı oradan kaldırın ve parolanızı sıfırlayın.',
  notYouRemoved: 'Siz değil miydiniz? Parolanızı sıfırlayın ve anahtarlarınızı orada kontrol edin.',
};

const uk: PasskeyNoticeText = {
  greeting: 'Вітаємо!',
  addedSubject: 'До вашого облікового запису {{app}} додано ключ доступу',
  addedNote: 'Той, хто має цей ключ, може увійти у ваш обліковий запис без пароля.',
  removedSubject: 'З вашого облікового запису {{app}} видалено ключ доступу',
  removedSubjectMany: 'З вашого облікового запису {{app}} видалено ключі доступу',
  synced: 'синхронізується між пристроями',
  deviceOnly: 'зберігається лише на одному пристрої',
  when: 'Коли: {{when}}',
  review: 'Перевірте ключі в розділі «Налаштування > Безпека > Ключі доступу»: {{url}}',
  notYouAdded: 'Це були не ви? Видаліть ключ там і змініть пароль через скидання.',
  notYouRemoved: 'Це були не ви? Змініть пароль через скидання й перевірте там свої ключі.',
};

const zh: PasskeyNoticeText = {
  greeting: '您好：',
  addedSubject: '您的 {{app}} 账户添加了一个通行密钥',
  addedNote: '持有此通行密钥的人无需密码即可登录您的账户。',
  removedSubject: '您的 {{app}} 账户删除了一个通行密钥',
  removedSubjectMany: '您的 {{app}} 账户删除了多个通行密钥',
  synced: '在设备间同步',
  deviceOnly: '仅保存在一台设备上',
  when: '时间：{{when}}',
  review: '请在“设置 > 安全 > 通行密钥”中查看：{{url}}',
  notYouAdded: '不是您本人？请在那里删除它并重置密码。',
  notYouRemoved: '不是您本人？请重置密码并在那里检查您的通行密钥。',
};

const pl: PasskeyNoticeText = {
  greeting: 'Dzień dobry,',
  addedSubject: 'Do Twojego konta {{app}} dodano klucz dostępu',
  addedNote: 'Każdy, kto ma ten klucz, może zalogować się na Twoje konto bez hasła.',
  removedSubject: 'Z Twojego konta {{app}} usunięto klucz dostępu',
  removedSubjectMany: 'Z Twojego konta {{app}} usunięto klucze dostępu',
  synced: 'synchronizowany między urządzeniami',
  deviceOnly: 'przechowywany tylko na jednym urządzeniu',
  when: 'Kiedy: {{when}}',
  review: 'Sprawdź klucze w Ustawienia > Bezpieczeństwo > Klucze dostępu: {{url}}',
  notYouAdded: 'To nie Ty? Usuń go tam i zresetuj hasło.',
  notYouRemoved: 'To nie Ty? Zresetuj hasło i sprawdź tam swoje klucze.',
};

const it: PasskeyNoticeText = {
  greeting: 'Ciao,',
  addedSubject: 'È stata aggiunta una passkey al tuo account {{app}}',
  addedNote: 'Chi possiede questa passkey può accedere al tuo account senza la password.',
  removedSubject: 'È stata rimossa una passkey dal tuo account {{app}}',
  removedSubjectMany: 'Sono state rimosse delle passkey dal tuo account {{app}}',
  synced: 'sincronizzata tra dispositivi',
  deviceOnly: 'conservata su un solo dispositivo',
  when: 'Quando: {{when}}',
  review: 'Controlla le tue passkey in Impostazioni > Sicurezza > Passkey: {{url}}',
  notYouAdded: 'Non sei stato tu? Rimuovila da lì e reimposta la password.',
  notYouRemoved: 'Non sei stato tu? Reimposta la password e controlla lì le tue passkey.',
};

const sk: PasskeyNoticeText = {
  greeting: 'Dobrý deň,',
  addedSubject: 'K vášmu účtu {{app}} bol pridaný prístupový kľúč',
  addedNote: 'Ktokoľvek má tento kľúč, sa môže prihlásiť do vášho účtu bez hesla.',
  removedSubject: 'Z vášho účtu {{app}} bol odstránený prístupový kľúč',
  removedSubjectMany: 'Z vášho účtu {{app}} boli odstránené prístupové kľúče',
  synced: 'synchronizovaný medzi zariadeniami',
  deviceOnly: 'uložený len na jednom zariadení',
  when: 'Kedy: {{when}}',
  review: 'Skontrolujte kľúče v Nastavenia > Zabezpečenie > Prístupové kľúče: {{url}}',
  notYouAdded: 'Neboli ste to vy? Odstráňte ho tam a obnovte si heslo.',
  notYouRemoved: 'Neboli ste to vy? Obnovte si heslo a skontrolujte tam svoje kľúče.',
};

const ja: PasskeyNoticeText = {
  greeting: 'こんにちは。',
  addedSubject: '{{app}} アカウントにパスキーが追加されました',
  addedNote: 'このパスキーを持つ人は、パスワードなしでアカウントにサインインできます。',
  removedSubject: '{{app}} アカウントからパスキーが削除されました',
  removedSubjectMany: '{{app}} アカウントから複数のパスキーが削除されました',
  synced: 'デバイス間で同期',
  deviceOnly: '1 台のデバイスにのみ保存',
  when: '日時: {{when}}',
  review: '「設定 > セキュリティ > パスキー」で確認してください: {{url}}',
  notYouAdded: 'お心当たりがない場合は、そこで削除してパスワードを再設定してください。',
  notYouRemoved: 'お心当たりがない場合は、パスワードを再設定し、そこでパスキーを確認してください。',
};

const ko: PasskeyNoticeText = {
  greeting: '안녕하세요.',
  addedSubject: '{{app}} 계정에 패스키가 추가되었습니다',
  addedNote: '이 패스키를 가진 사람은 비밀번호 없이 계정에 로그인할 수 있습니다.',
  removedSubject: '{{app}} 계정에서 패스키가 삭제되었습니다',
  removedSubjectMany: '{{app}} 계정에서 여러 패스키가 삭제되었습니다',
  synced: '기기 간 동기화됨',
  deviceOnly: '한 기기에만 저장됨',
  when: '일시: {{when}}',
  review: '설정 > 보안 > 패스키에서 확인하세요: {{url}}',
  notYouAdded: '본인이 아니라면 그곳에서 삭제하고 비밀번호를 재설정하세요.',
  notYouRemoved: '본인이 아니라면 비밀번호를 재설정하고 그곳에서 패스키를 확인하세요.',
};

const hi: PasskeyNoticeText = {
  greeting: 'नमस्ते,',
  addedSubject: 'आपके {{app}} खाते में एक पासकी जोड़ी गई',
  addedNote: 'जिसके पास यह पासकी है, वह पासवर्ड के बिना आपके खाते में साइन इन कर सकता है।',
  removedSubject: 'आपके {{app}} खाते से एक पासकी हटाई गई',
  removedSubjectMany: 'आपके {{app}} खाते से पासकी हटाई गईं',
  synced: 'डिवाइसों के बीच सिंक',
  deviceOnly: 'केवल एक डिवाइस पर रखी गई',
  when: 'कब: {{when}}',
  review: 'सेटिंग्स > सुरक्षा > पासकी में अपनी पासकी देखें: {{url}}',
  notYouAdded: 'यह आप नहीं थे? उसे वहाँ से हटाएँ और अपना पासवर्ड रीसेट करें।',
  notYouRemoved: 'यह आप नहीं थे? अपना पासवर्ड रीसेट करें और वहाँ अपनी पासकी जाँचें।',
};

const nl: PasskeyNoticeText = {
  greeting: 'Hallo,',
  addedSubject: 'Er is een toegangssleutel toegevoegd aan je {{app}}-account',
  addedNote: 'Wie deze sleutel heeft, kan zonder wachtwoord inloggen op je account.',
  removedSubject: 'Er is een toegangssleutel verwijderd uit je {{app}}-account',
  removedSubjectMany: 'Er zijn toegangssleutels verwijderd uit je {{app}}-account',
  synced: 'gesynchroniseerd tussen apparaten',
  deviceOnly: 'op één apparaat bewaard',
  when: 'Wanneer: {{when}}',
  review: 'Controleer je sleutels via Instellingen > Beveiliging > Toegangssleutels: {{url}}',
  notYouAdded: 'Was jij dit niet? Verwijder hem daar en stel je wachtwoord opnieuw in.',
  notYouRemoved: 'Was jij dit niet? Stel je wachtwoord opnieuw in en controleer daar je sleutels.',
};

const sv: PasskeyNoticeText = {
  greeting: 'Hej,',
  addedSubject: 'En nyckel lades till på ditt {{app}}-konto',
  addedNote: 'Den som har den här nyckeln kan logga in på ditt konto utan lösenordet.',
  removedSubject: 'En nyckel togs bort från ditt {{app}}-konto',
  removedSubjectMany: 'Nycklar togs bort från ditt {{app}}-konto',
  synced: 'synkas mellan enheter',
  deviceOnly: 'finns bara på en enhet',
  when: 'När: {{when}}',
  review: 'Granska dina nycklar under Inställningar > Säkerhet > Nycklar: {{url}}',
  notYouAdded: 'Var det inte du? Ta bort den där och återställ ditt lösenord.',
  notYouRemoved: 'Var det inte du? Återställ ditt lösenord och kontrollera dina nycklar där.',
};

const vi: PasskeyNoticeText = {
  greeting: 'Xin chào,',
  addedSubject: 'Một khóa truy cập đã được thêm vào tài khoản {{app}} của bạn',
  addedNote:
    'Bất kỳ ai có khóa này đều có thể đăng nhập vào tài khoản của bạn mà không cần mật khẩu.',
  removedSubject: 'Một khóa truy cập đã bị xóa khỏi tài khoản {{app}} của bạn',
  removedSubjectMany: 'Các khóa truy cập đã bị xóa khỏi tài khoản {{app}} của bạn',
  synced: 'đồng bộ giữa các thiết bị',
  deviceOnly: 'chỉ lưu trên một thiết bị',
  when: 'Thời điểm: {{when}}',
  review: 'Xem lại khóa trong Cài đặt > Bảo mật > Khóa truy cập: {{url}}',
  notYouAdded: 'Không phải bạn? Hãy xóa khóa đó ở đó và đặt lại mật khẩu.',
  notYouRemoved: 'Không phải bạn? Hãy đặt lại mật khẩu và kiểm tra các khóa của bạn ở đó.',
};

const id: PasskeyNoticeText = {
  greeting: 'Halo,',
  addedSubject: 'Kunci sandi ditambahkan ke akun {{app}} Anda',
  addedNote: 'Siapa pun yang memiliki kunci sandi ini bisa masuk ke akun Anda tanpa kata sandi.',
  removedSubject: 'Kunci sandi dihapus dari akun {{app}} Anda',
  removedSubjectMany: 'Beberapa kunci sandi dihapus dari akun {{app}} Anda',
  synced: 'tersinkron antarperangkat',
  deviceOnly: 'hanya tersimpan di satu perangkat',
  when: 'Waktu: {{when}}',
  review: 'Tinjau kunci sandi Anda di Pengaturan > Keamanan > Kunci sandi: {{url}}',
  notYouAdded: 'Bukan Anda? Hapus di sana dan atur ulang kata sandi Anda.',
  notYouRemoved: 'Bukan Anda? Atur ulang kata sandi Anda dan periksa kunci sandi Anda di sana.',
};

const da: PasskeyNoticeText = {
  greeting: 'Hej,',
  addedSubject: 'En adgangsnøgle blev føjet til din {{app}}-konto',
  addedNote: 'Den, der har denne nøgle, kan logge ind på din konto uden adgangskoden.',
  removedSubject: 'En adgangsnøgle blev fjernet fra din {{app}}-konto',
  removedSubjectMany: 'Adgangsnøgler blev fjernet fra din {{app}}-konto',
  synced: 'synkroniseret mellem enheder',
  deviceOnly: 'kun gemt på én enhed',
  when: 'Hvornår: {{when}}',
  review: 'Gennemgå dine nøgler under Indstillinger > Sikkerhed > Adgangsnøgler: {{url}}',
  notYouAdded: 'Var det ikke dig? Fjern den der, og nulstil din adgangskode.',
  notYouRemoved: 'Var det ikke dig? Nulstil din adgangskode, og tjek dine nøgler der.',
};

const nb: PasskeyNoticeText = {
  greeting: 'Hei,',
  addedSubject: 'En passnøkkel ble lagt til på {{app}}-kontoen din',
  addedNote: 'Den som har denne passnøkkelen, kan logge inn på kontoen din uten passordet.',
  removedSubject: 'En passnøkkel ble fjernet fra {{app}}-kontoen din',
  removedSubjectMany: 'Passnøkler ble fjernet fra {{app}}-kontoen din',
  synced: 'synkronisert mellom enheter',
  deviceOnly: 'bare lagret på én enhet',
  when: 'Når: {{when}}',
  review: 'Gå gjennom passnøklene under Innstillinger > Sikkerhet > Passnøkler: {{url}}',
  notYouAdded: 'Var det ikke deg? Fjern den der, og tilbakestill passordet ditt.',
  notYouRemoved: 'Var det ikke deg? Tilbakestill passordet ditt, og sjekk passnøklene dine der.',
};

const nn: PasskeyNoticeText = {
  greeting: 'Hei,',
  addedSubject: 'Ein passnøkkel vart lagd til på {{app}}-kontoen din',
  addedNote: 'Den som har denne passnøkkelen, kan logge inn på kontoen din utan passordet.',
  removedSubject: 'Ein passnøkkel vart fjerna frå {{app}}-kontoen din',
  removedSubjectMany: 'Passnøklar vart fjerna frå {{app}}-kontoen din',
  synced: 'synkronisert mellom einingar',
  deviceOnly: 'berre lagra på éi eining',
  when: 'Når: {{when}}',
  review: 'Gå gjennom passnøklane under Innstillingar > Tryggleik > Passnøklar: {{url}}',
  notYouAdded: 'Var det ikkje deg? Fjern han der, og tilbakestill passordet ditt.',
  notYouRemoved: 'Var det ikkje deg? Tilbakestill passordet ditt, og sjekk passnøklane dine der.',
};

const fi: PasskeyNoticeText = {
  greeting: 'Hei,',
  addedSubject: '{{app}}-tiliisi lisättiin pääsyavain',
  addedNote: 'Kuka tahansa, jolla on tämä avain, voi kirjautua tilillesi ilman salasanaa.',
  removedSubject: '{{app}}-tililtäsi poistettiin pääsyavain',
  removedSubjectMany: '{{app}}-tililtäsi poistettiin pääsyavaimia',
  synced: 'synkronoidaan laitteiden välillä',
  deviceOnly: 'tallessa vain yhdellä laitteella',
  when: 'Milloin: {{when}}',
  review: 'Tarkista avaimesi kohdassa Asetukset > Tietoturva > Pääsyavaimet: {{url}}',
  notYouAdded: 'Etkö se ollut sinä? Poista avain siellä ja nollaa salasanasi.',
  notYouRemoved: 'Etkö se ollut sinä? Nollaa salasanasi ja tarkista avaimesi siellä.',
};

const is: PasskeyNoticeText = {
  greeting: 'Halló,',
  addedSubject: 'Aðgangslykli var bætt við {{app}}-reikninginn þinn',
  addedNote: 'Hver sem hefur þennan lykil getur skráð sig inn á reikninginn þinn án lykilorðsins.',
  removedSubject: 'Aðgangslykill var fjarlægður af {{app}}-reikningnum þínum',
  removedSubjectMany: 'Aðgangslyklar voru fjarlægðir af {{app}}-reikningnum þínum',
  synced: 'samstilltur milli tækja',
  deviceOnly: 'aðeins geymdur á einu tæki',
  when: 'Hvenær: {{when}}',
  review: 'Farðu yfir lyklana í Stillingar > Öryggi > Aðgangslyklar: {{url}}',
  notYouAdded: 'Varst þetta ekki þú? Fjarlægðu hann þar og endurstilltu lykilorðið.',
  notYouRemoved: 'Varst þetta ekki þú? Endurstilltu lykilorðið og athugaðu lyklana þína þar.',
};

const fo: PasskeyNoticeText = {
  greeting: 'Hey,',
  addedSubject: 'Ein atgongdslykil varð lagdur afturat {{app}}-kontuni hjá tær',
  addedNote: 'Hvør ið hevur hendan lykilin, kann rita inn á kontu tína uttan loyniorðið.',
  removedSubject: 'Ein atgongdslykil varð strikaður av {{app}}-kontuni hjá tær',
  removedSubjectMany: 'Atgongdslyklar vórðu strikaðir av {{app}}-kontuni hjá tær',
  synced: 'samstillaður millum tól',
  deviceOnly: 'bert goymdur á einum tóli',
  when: 'Nær: {{when}}',
  review: 'Kanna lyklarnar undir Stillingar > Trygd > Atgongdslyklar: {{url}}',
  notYouAdded: 'Var tað ikki tú? Strika hann har og nullstilla loyniorðið.',
  notYouRemoved: 'Var tað ikki tú? Nullstilla loyniorðið og kanna lyklarnar har.',
};

const cs: PasskeyNoticeText = {
  greeting: 'Dobrý den,',
  addedSubject: 'K vašemu účtu {{app}} byl přidán přístupový klíč',
  addedNote: 'Kdokoli má tento klíč, se může přihlásit k vašemu účtu bez hesla.',
  removedSubject: 'Z vašeho účtu {{app}} byl odebrán přístupový klíč',
  removedSubjectMany: 'Z vašeho účtu {{app}} byly odebrány přístupové klíče',
  synced: 'synchronizovaný mezi zařízeními',
  deviceOnly: 'uložený jen na jednom zařízení',
  when: 'Kdy: {{when}}',
  review: 'Zkontrolujte klíče v Nastavení > Zabezpečení > Přístupové klíče: {{url}}',
  notYouAdded: 'Nebyli jste to vy? Odeberte ho tam a obnovte si heslo.',
  notYouRemoved: 'Nebyli jste to vy? Obnovte si heslo a zkontrolujte tam své klíče.',
};

const bg: PasskeyNoticeText = {
  greeting: 'Здравейте,',
  addedSubject: 'Към профила ви в {{app}} е добавен ключ за достъп',
  addedNote: 'Който има този ключ, може да влезе в профила ви без паролата.',
  removedSubject: 'От профила ви в {{app}} е премахнат ключ за достъп',
  removedSubjectMany: 'От профила ви в {{app}} са премахнати ключове за достъп',
  synced: 'синхронизира се между устройства',
  deviceOnly: 'пази се само на едно устройство',
  when: 'Кога: {{when}}',
  review: 'Прегледайте ключовете в Настройки > Сигурност > Ключове за достъп: {{url}}',
  notYouAdded: 'Не бяхте вие? Премахнете го там и нулирайте паролата си.',
  notYouRemoved: 'Не бяхте вие? Нулирайте паролата си и проверете ключовете си там.',
};

const hr: PasskeyNoticeText = {
  greeting: 'Pozdrav,',
  addedSubject: 'Vašem {{app}} računu dodan je pristupni ključ',
  addedNote: 'Tko god ima ovaj ključ, može se prijaviti u vaš račun bez lozinke.',
  removedSubject: 'S vašeg {{app}} računa uklonjen je pristupni ključ',
  removedSubjectMany: 'S vašeg {{app}} računa uklonjeni su pristupni ključevi',
  synced: 'sinkronizira se među uređajima',
  deviceOnly: 'čuva se samo na jednom uređaju',
  when: 'Kada: {{when}}',
  review: 'Provjerite ključeve u Postavke > Sigurnost > Pristupni ključevi: {{url}}',
  notYouAdded: 'Niste to bili vi? Uklonite ga ondje i poništite lozinku.',
  notYouRemoved: 'Niste to bili vi? Poništite lozinku i ondje provjerite svoje ključeve.',
};

const sr: PasskeyNoticeText = {
  greeting: 'Поздрав,',
  addedSubject: 'Вашем {{app}} налогу додат је приступни кључ',
  addedNote: 'Ко год има овај кључ, може да се пријави на ваш налог без лозинке.',
  removedSubject: 'Са вашег {{app}} налога уклоњен је приступни кључ',
  removedSubjectMany: 'Са вашег {{app}} налога уклоњени су приступни кључеви',
  synced: 'синхронизује се између уређаја',
  deviceOnly: 'чува се само на једном уређају',
  when: 'Када: {{when}}',
  review: 'Проверите кључеве у Подешавања > Безбедност > Приступни кључеви: {{url}}',
  notYouAdded: 'Нисте то били ви? Уклоните га тамо и ресетујте лозинку.',
  notYouRemoved: 'Нисте то били ви? Ресетујте лозинку и тамо проверите своје кључеве.',
};

const sl: PasskeyNoticeText = {
  greeting: 'Pozdravljeni,',
  addedSubject: 'Vašemu računu {{app}} je bil dodan ključ za dostop',
  addedNote: 'Kdor ima ta ključ, se lahko prijavi v vaš račun brez gesla.',
  removedSubject: 'Iz vašega računa {{app}} je bil odstranjen ključ za dostop',
  removedSubjectMany: 'Iz vašega računa {{app}} so bili odstranjeni ključi za dostop',
  synced: 'sinhroniziran med napravami',
  deviceOnly: 'shranjen le v eni napravi',
  when: 'Kdaj: {{when}}',
  review: 'Preglejte ključe v Nastavitve > Varnost > Ključi za dostop: {{url}}',
  notYouAdded: 'To niste bili vi? Tam ga odstranite in ponastavite geslo.',
  notYouRemoved: 'To niste bili vi? Ponastavite geslo in tam preverite svoje ključe.',
};

const mk: PasskeyNoticeText = {
  greeting: 'Здраво,',
  addedSubject: 'На вашата {{app}} сметка е додаден клуч за пристап',
  addedNote: 'Кој и да го има овој клуч, може да се најави на вашата сметка без лозинката.',
  removedSubject: 'Од вашата {{app}} сметка е отстранет клуч за пристап',
  removedSubjectMany: 'Од вашата {{app}} сметка се отстранети клучеви за пристап',
  synced: 'се синхронизира меѓу уреди',
  deviceOnly: 'се чува само на еден уред',
  when: 'Кога: {{when}}',
  review: 'Проверете ги клучевите во Поставки > Безбедност > Клучеви за пристап: {{url}}',
  notYouAdded: 'Не бевте вие? Отстранете го таму и ресетирајте ја лозинката.',
  notYouRemoved: 'Не бевте вие? Ресетирајте ја лозинката и таму проверете ги клучевите.',
};

const be: PasskeyNoticeText = {
  greeting: 'Вітаем!',
  addedSubject: 'Да вашага акаўнта {{app}} дададзены ключ доступу',
  addedNote: 'Той, у каго ёсць гэты ключ, можа ўвайсці ў ваш акаўнт без пароля.',
  removedSubject: 'З вашага акаўнта {{app}} выдалены ключ доступу',
  removedSubjectMany: 'З вашага акаўнта {{app}} выдалены ключы доступу',
  synced: 'сінхранізуецца паміж прыладамі',
  deviceOnly: 'захоўваецца толькі на адной прыладзе',
  when: 'Калі: {{when}}',
  review: 'Праверце ключы ў раздзеле «Налады > Бяспека > Ключы доступу»: {{url}}',
  notYouAdded: 'Гэта былі не вы? Выдаліце ключ там і змяніце пароль праз скід.',
  notYouRemoved: 'Гэта былі не вы? Змяніце пароль праз скід і праверце там свае ключы.',
};

const bs: PasskeyNoticeText = {
  greeting: 'Pozdrav,',
  addedSubject: 'Vašem {{app}} računu dodan je pristupni ključ',
  addedNote: 'Ko god ima ovaj ključ, može se prijaviti na vaš račun bez lozinke.',
  removedSubject: 'S vašeg {{app}} računa uklonjen je pristupni ključ',
  removedSubjectMany: 'S vašeg {{app}} računa uklonjeni su pristupni ključevi',
  synced: 'sinhronizuje se između uređaja',
  deviceOnly: 'čuva se samo na jednom uređaju',
  when: 'Kada: {{when}}',
  review: 'Provjerite ključeve u Postavke > Sigurnost > Pristupni ključevi: {{url}}',
  notYouAdded: 'Niste to bili vi? Uklonite ga tamo i resetujte lozinku.',
  notYouRemoved: 'Niste to bili vi? Resetujte lozinku i tamo provjerite svoje ključeve.',
};

const hsb: PasskeyNoticeText = {
  greeting: 'Witajće,',
  addedSubject: 'Wašemu kontu {{app}} je so přistupny kluč přidał',
  addedNote: 'Štóž tutón kluč ma, móže so bjez hesła do wašeho konta přizjewić.',
  removedSubject: 'Z wašeho konta {{app}} je so přistupny kluč wotstronił',
  removedSubjectMany: 'Z wašeho konta {{app}} su so přistupne kluče wotstronili',
  synced: 'mjez gratami synchronizowany',
  deviceOnly: 'jenož na jednym graće składowany',
  when: 'Hdy: {{when}}',
  review: 'Přepruwujće swoje kluče pod Nastajenja > Wěstota > Přistupne kluče: {{url}}',
  notYouAdded: 'Njejsće to wy byli? Wotstrońće jón tam a stajće swoje hesło wróćo.',
  notYouRemoved: 'Njejsće to wy byli? Stajće swoje hesło wróćo a přepruwujće tam swoje kluče.',
};

export const PASSKEY_NOTICE_TRANSLATIONS: Record<string, PasskeyNoticeText> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};
