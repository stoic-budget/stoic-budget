import type { StoicTextMap } from './types';

export const vi: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Tháng này đã vượt kế hoạch',
      message:
        'Bạn dự định chi {{plannedAmount}} và đã chi {{spentAmount}} — nhiều hơn {{percent}}%. Kế hoạch được lập khi đầu óc sáng suốt; hãy để nó lên tiếng mạnh hơn cảm xúc nhất thời.',
    },
    {
      title: 'Vượt {{percent}}% so với dự định',
      message:
        'Chi tiêu đang là {{spentAmount}} so với kế hoạch {{plannedAmount}}. Hãy xem giới hạn nào vỡ trước tiên — bài học nằm ở đó.',
    },
    {
      title: 'Kế hoạch và tháng này không khớp nhau',
      message:
        'Đã chi {{spentAmount}}, dự định {{plannedAmount}}. Hoặc kế hoạch đòi hỏi quá ít ở thực tế, hoặc thực tế đòi hỏi quá nhiều ở bạn — hãy bình tĩnh xác định là điều nào.',
    },
    {
      title: 'Tiền ra nhiều hơn bạn cho phép',
      message:
        'Tháng này vượt {{percent}}% so với mức {{plannedAmount}} bạn đặt ra. Dừng lại bây giờ chẳng mất gì; giả vờ như chưa có gì xảy ra thì mất nhiều.',
    },
    {
      title: 'Giới hạn tự đặt, tự vượt qua',
      message:
        'Bạn định chi {{plannedAmount}}; thực tế là {{spentAmount}}. Tự chủ không phải là không bao giờ trượt chân — mà là nhận ra sớm và quay lại đúng đường.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Giải trí chiếm nhiều hơn dự định',
      message:
        'Bạn định để giải trí chiếm {{planned}}% chi tiêu; thực tế là {{actual}}%. Niềm vui đáng được đón như khách, không phải như chủ nhà.',
    },
    {
      title: 'Giải trí {{actual}}%, dự định {{planned}}%',
      message:
        'Nghỉ ngơi xứng đáng có chỗ của nó khi nó giúp bạn hồi phục. Hãy tự hỏi niềm vui nào trong tháng thực sự làm được điều đó, và buông phần còn lại mà không tiếc nuối.',
    },
    {
      title: 'Sự thoải mái đang vượt qua ý định',
      message:
        'Giải trí chiếm {{actual}}% chi tiêu so với {{planned}}% bạn đã chọn. Điều độ không phải là từ chối niềm vui — mà là giữ nó đúng kích cỡ bạn đã quyết.',
    },
    {
      title: 'Điều dễ chịu lấn át điều đã định',
      message:
        'Bạn dành cho giải trí {{planned}}% kế hoạch và nó đã lấy {{actual}}%. Thứ ta hưởng thụ quá dễ dàng đáng được nhìn lại trước khi nó trở thành thứ ta cần.',
    },
    {
      title: 'Giải trí đã bước qua vạch',
      message:
        '{{actual}}% tháng này dành cho giải trí, còn dự định là {{planned}}%. Vạch ấy do bạn vẽ, và cũng do bạn giữ.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Giải trí lại vượt kế hoạch',
      message:
        'Giải trí vượt kế hoạch trong {{months}} trên {{window}} tháng gần nhất. Lặp lại thì không còn là tình cờ — đó là một thói quen đáng xem xét.',
    },
    {
      title: '{{months}} trên {{window}} tháng giải trí vượt kế hoạch',
      message:
        'Điều xảy ra một lần là hoàn cảnh; điều xảy ra {{months}} lần là tính cách đang hình thành. Hãy chọn tính cách ấy một cách có chủ đích.',
    },
    {
      title: 'Cùng một lần trượt, tháng này qua tháng khác',
      message:
        'Giải trí vượt kế hoạch trong {{months}} trên {{window}} tháng. Hoặc nâng kế hoạch lên một cách trung thực, hoặc thay đổi thói quen — lưng chừng giữa hai điều đó là tốn kém nhất.',
    },
    {
      title: 'Một khuôn mẫu, không phải một sơ suất',
      message:
        'Trong {{months}} trên {{window}} tháng gần nhất, giải trí lấy nhiều hơn phần bạn dành cho nó. Hãy để ý khoảnh khắc quyết định được đưa ra, chứ không chỉ hóa đơn sau đó.',
    },
    {
      title: 'Thói quen đang bỏ phiếu chống lại kế hoạch',
      message:
        'Giải trí thắng kế hoạch {{months}} lần trong {{window}} tháng. Thói quen được xây từ từng lựa chọn; việc tháo gỡ nó cũng vậy.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Đức hạnh nhận ít hơn dự định',
      message:
        'Bạn dành {{planned}}% ngân sách cho sức khỏe, học tập và những người khác; thực tế là {{actual}}%. Một ý định chỉ có giá trị khi được thực hiện.',
    },
    {
      title: 'Đức hạnh {{actual}}% trên {{planned}}% dự định',
      message:
        'Khoản tiền bạn định dành cho những gì giúp bạn tốt hơn vẫn đang chờ. Không có lúc nào tốt hơn bây giờ để tiêu nó cho xứng đáng.',
    },
    {
      title: 'Điều tốt bạn định làm vẫn chưa được chi',
      message:
        'Sức khỏe, học tập và lòng rộng lượng lẽ ra nhận {{planned}}% chi tiêu; chúng mới nhận {{actual}}%. Tuần này hãy làm một trong số đó, có chủ đích.',
    },
    {
      title: 'Ý định mà chưa có hành động',
      message:
        'Đức hạnh chiếm {{actual}}% chi tiêu so với {{planned}}% bạn đã chọn. Điều ta coi trọng lộ ra ở thứ ta thực sự trả tiền cho.',
    },
    {
      title: 'Vẫn còn chỗ cho điều quan trọng',
      message:
        'Chỉ {{actual}}% dành cho đức hạnh, dù bạn đã định {{planned}}%. Một cuốn sách, một lần khám sức khỏe, một món quà cho người đang cần — kế hoạch đã đồng ý rồi.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Đức hạnh cứ bị trì hoãn',
      message:
        'Chi tiêu cho sức khỏe, học tập và người khác đã thấp hơn kế hoạch {{months}} tháng liên tiếp. Điều bạn cứ trì hoãn, thực ra bạn đã từ chối rồi.',
    },
    {
      title: '{{months}} tháng trì hoãn đức hạnh',
      message:
        'Tháng nào kế hoạch cũng chừa chỗ cho điều giúp bạn tốt hơn, và tháng nào chỗ ấy cũng bị bỏ trống. Thời gian là thứ duy nhất bạn không thể lập ngân sách hai lần.',
    },
    {
      title: 'Phiên bản tốt hơn của bạn vẫn đang chờ',
      message:
        'Đức hạnh đã dưới kế hoạch {{months}} tháng liền. Hãy bắt đầu nhỏ và chắc chắn, thay vì lớn lao và để sau.',
    },
    {
      title: 'Ý tốt đang già đi',
      message:
        'Suốt {{months}} tháng, sức khỏe, học tập và lòng rộng lượng nhận ít hơn kế hoạch. Tháng sau hãy chọn một điều và cấp tiền cho nó trước mọi thứ khác.',
    },
    {
      title: 'Đức hạnh cứ thua "để sau"',
      message:
        '{{months}} tháng liên tiếp dưới kế hoạch. "Để sau" là nơi ý tốt bị lãng quên — hãy cho điều này một ngày cụ thể.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Kế hoạch của bạn không có chỗ cho đức hạnh',
      message:
        'Không ngân sách nào của bạn phục vụ sức khỏe, học tập hay người khác. Kế hoạch cho thấy ta coi trọng điều gì — hãy cân nhắc cho đức hạnh một dòng riêng.',
    },
    {
      title: 'Mọi thứ đều có ngân sách, trừ điều tốt',
      message:
        'Thiết yếu, công việc và giải trí đều có giới hạn; đức hạnh thì không. Điều chưa bao giờ được lên kế hoạch thường chẳng bao giờ xảy ra.',
    },
    {
      title: 'Lên kế hoạch cho điều giúp bạn tốt hơn',
      message:
        'Nhóm đức hạnh chưa có ngân sách nào. Dù nhỏ — sách, thể thao, một khoản quyên góp — nó cũng biến mong muốn thành cam kết.',
    },
    {
      title: 'Kế hoạch im lặng về đức hạnh',
      message:
        'Bạn lập ngân sách cho điều phải làm và điều mình thích, nhưng chưa cho con người bạn muốn trở thành. Một ngân sách đức hạnh khiêm tốn sẽ thay đổi điều đó.',
    },
    {
      title: 'Đức hạnh không có ngân sách',
      message:
        'Chi tiêu cho sức khỏe, học tập hay người khác không được lên kế hoạch ở đâu cả. Hãy chọn một mục và đặt cho nó một giới hạn mà bạn vui khi chạm tới.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Thiết yếu tốn hơn dự định',
      message:
        'Bạn dự định {{planned}}% chi tiêu cho thiết yếu; thực tế là {{actual}}%. Hãy kiểm tra xem từng khoản còn là nhu cầu, hay đã lặng lẽ trở thành tiện nghi.',
    },
    {
      title: 'Thiết yếu {{actual}}%, dự định {{planned}}%',
      message:
        'Điều cuộc sống thực sự đòi hỏi thường ít hơn những gì ta đã quen. Hãy nhìn khoản thiết yếu lớn nhất bằng con mắt mới.',
    },
    {
      title: 'Những khoản cơ bản đang phình ra',
      message:
        'Thiết yếu chiếm {{actual}}% tháng này so với {{planned}}% bạn dự tính. Một nhu cầu cứ lớn dần đáng được đặt câu hỏi.',
    },
    {
      title: 'Nhu cầu đang vượt khỏi kế hoạch',
      message:
        'Dự định {{planned}}%, thực tế {{actual}}%. Hoặc kế hoạch đã đánh giá thấp chi phí thật, hoặc vài mong muốn đang mang danh nhu cầu.',
    },
    {
      title: 'Chi cho "bắt buộc" nhiều hơn dự tính',
      message:
        'Thiết yếu chiếm {{actual}}% chi tiêu thay vì {{planned}}%. Hãy tách điều thật sự bắt buộc khỏi điều chỉ đơn giản là xưa nay vẫn vậy.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Thiết yếu đang lặng lẽ tăng',
      message:
        'Chi tiêu thiết yếu đã tăng {{months}} tháng liên tiếp, tổng cộng {{percent}}%. Nhu cầu lớn lên lặng lẽ khi không ai bắt chúng giải thích.',
    },
    {
      title: '+{{percent}}% cho thiết yếu trong {{months}} tháng',
      message:
        'Mỗi bước trông đều nhỏ; gộp lại thì không. Hãy lấy khoản thiết yếu định kỳ lớn nhất và hỏi xem nó có còn phải tốn chừng ấy không.',
    },
    {
      title: 'Mức sàn chi tiêu của bạn đang nâng lên',
      message:
        'Thiết yếu tăng {{months}} tháng liên tục (+{{percent}}%). Sàn càng cao, chỗ cho những gì bạn tự do lựa chọn càng hẹp.',
    },
    {
      title: 'Nhu cầu đang mở rộng',
      message:
        '{{months}} tháng tăng, tổng cộng {{percent}}%. Phép thử khắc kỷ rất đơn giản: biết giá của nó rồi, hôm nay bạn có chọn lại không?',
    },
    {
      title: 'Tăng nhẹ, nhưng cùng một hướng',
      message:
        'Thiết yếu tăng {{percent}}% trong {{months}} tháng. Hướng đi quan trọng hơn bất kỳ tháng nào — hướng này đáng được sửa sớm.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Công việc tốn hơn dự định',
      message:
        'Bạn dự định {{planned}}% chi tiêu cho công việc; thực tế là {{actual}}%. Công cụ và dịch vụ phải xứng với đồng tiền — hãy xem cái nào làm được.',
    },
    {
      title: 'Chi cho công việc {{actual}}%, dự định {{planned}}%',
      message:
        'Đầu tư cho công việc là tốt khi nó mang lại điều gì đó. Hãy rà soát những thứ bạn vẫn trả tiền nhưng không còn dùng.',
    },
    {
      title: 'Ngân sách công việc đang căng',
      message:
        'Công việc chiếm {{actual}}% thay vì {{planned}}%. Siêng năng là làm tốt công việc, không phải mua mọi công cụ cho nó.',
    },
    {
      title: 'Công cụ đang chi vượt kế hoạch',
      message:
        'Dự định {{planned}}%, đã chi {{actual}}% cho công việc. Hãy hỏi mỗi khoản: nó giúp tôi làm việc, hay chỉ cho cảm giác đang tiến bộ?',
    },
    {
      title: 'Chi phí công việc đã trôi dần',
      message:
        'Công việc chiếm {{actual}}% chi tiêu so với {{planned}}% dự định. Một lần rà soát nhanh bây giờ đỡ một lần dọn dẹp lớn về sau.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '"{{category}}" lại vượt giới hạn',
      message:
        '"{{category}}" vượt ngân sách trong {{months}} trên {{window}} tháng gần nhất. Hoặc giới hạn sai, hoặc mong muốn sai — hãy quyết định là cái nào.',
    },
    {
      title: '"{{category}}": vượt ngân sách {{months}} trên {{window}} tháng',
      message:
        'Một giới hạn luôn bị vượt qua không còn là giới hạn, chỉ là mong ước. Hãy làm nó trung thực — nâng lên có chủ đích hoặc giữ nguyên có chủ đích.',
    },
    {
      title: 'Cùng một ngân sách lại vỡ',
      message:
        '"{{category}}" đã vượt giới hạn {{months}} lần trong {{window}} tháng. Sự lặp lại là thông tin; hãy dùng nó.',
    },
    {
      title: '"{{category}}" cần bạn chú ý',
      message:
        'Vượt ngân sách trong {{months}} trên {{window}} tháng. Hãy để ý khoảnh khắc ngay trước khi mua — đó là nơi duy nhất thói quen có thể thay đổi.',
    },
    {
      title: 'Một khuôn mẫu ở "{{category}}"',
      message:
        '{{months}} lần vượt trong {{window}} tháng. Điều ta lặp lại sẽ thành chính ta; hãy quyết định bạn muốn danh mục này nói gì về mình.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '"{{category}}" sẽ cạn vào ngày {{day}}',
      message:
        'Bạn đã chi {{spentAmount}} trên {{limitAmount}}, và với tốc độ này giới hạn sẽ hết vào khoảng ngày {{day}}. Chậm lại bây giờ dễ hơn dừng lại về sau.',
    },
    {
      title: '"{{category}}" đang đi trước tháng',
      message:
        'Đã tiêu {{spentAmount}} trên giới hạn {{limitAmount}}. Với nhịp này nó cạn vào ngày {{day}} — phần còn lại của tháng vẫn do bạn định hình.',
    },
    {
      title: 'Kiểm tra nhịp chi: "{{category}}"',
      message:
        'Với tốc độ hiện tại, ngân sách {{limitAmount}} chỉ kéo dài đến khoảng ngày {{day}}. Nhìn xa là loại kỷ luật rẻ nhất.',
    },
    {
      title: '"{{category}}" đang tiêu vào tương lai',
      message:
        'Đã chi {{spentAmount}} trên {{limitAmount}}; giới hạn sẽ hết gần ngày {{day}}. Điều bạn làm tuần này quyết định việc đó có xảy ra hay không.',
    },
    {
      title: 'Cảnh báo sớm cho "{{category}}"',
      message:
        'Với tốc độ hiện tại, giới hạn {{limitAmount}} sẽ không trụ đến cuối tháng — nó cạn vào khoảng ngày {{day}}. Hãy điều chỉnh khi cái giá còn nhỏ.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '"{{category}}" chưa được dùng đến',
      message:
        'Ngân sách "{{category}}" không có khoản chi nào trong {{months}} tháng. Hoặc bạn đã không còn cần nó, hoặc đó là một ý định vẫn đang chờ — hãy quyết định là điều nào.',
    },
    {
      title: 'Một ngân sách trống: "{{category}}"',
      message:
        '{{months}} tháng không một khoản chi. Kế hoạch nên mô tả cuộc sống bạn đang sống hoặc cuộc sống bạn đang xây dựng — cái này là loại nào?',
    },
    {
      title: '"{{category}}" đang để không',
      message:
        'Không chi gì ở đây trong {{months}} tháng. Nếu đó là kiềm chế, làm tốt lắm; nếu là lơ là, hãy hành động.',
    },
    {
      title: 'Có kế hoạch, nhưng chưa sống',
      message:
        '"{{category}}" có giới hạn nhưng không có khoản chi nào trong {{months}} tháng. Giữ kế hoạch trung thực: xóa nó đi hoặc dùng đến nó.',
    },
    {
      title: '"{{category}}": {{months}} tháng lặng lẽ',
      message:
        'Một ngân sách không bao giờ được chạm đến vẫn chiếm một chỗ trong kế hoạch. Hãy giải phóng chỗ ấy hoặc thực hiện ý định.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% chi tiêu không có giới hạn',
      message:
        '{{unbudgetedAmount}} của tháng đã chảy vào những danh mục không ngân sách nào theo dõi. Điều bạn chưa nhìn thì bạn không thể phán xét.',
    },
    {
      title: 'Phần lớn tháng này nằm ngoài kế hoạch',
      message:
        '{{percent}}% chi tiêu — {{unbudgetedAmount}} — nằm ngoài mọi ngân sách. Hãy đặt giới hạn cho khoản lớn nhất trong số đó, và kế hoạch sẽ thấy được nhiều hơn cuộc sống của bạn.',
    },
    {
      title: 'Chi tiêu ngoài kế hoạch',
      message:
        'Ngân sách chỉ bao quát một phần những gì bạn chi; {{unbudgetedAmount}} ({{percent}}%) không được đo lường. Hãy mở rộng kế hoạch đến nơi tiền thực sự đi.',
    },
    {
      title: 'Kế hoạch chỉ thấy một phần bức tranh',
      message:
        '{{percent}}% chi tiêu trong tháng không có ngân sách. Nhìn rõ đi trước phán đoán tốt.',
    },
    {
      title: '{{unbudgetedAmount}} chi tiêu không giới hạn',
      message:
        'Đó là {{percent}}% của tháng. Bạn không cần phải hạn chế nó — chỉ cần quyết định bạn thực sự muốn bao nhiêu trong số đó.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '"{{category}}" chiếm phần lớn giải trí',
      message:
        '{{percent}}% chi tiêu giải trí dành cho “{{category}}”. Hãy tận hưởng, nhưng kiểm tra xem bạn có thể rời bỏ nó không.',
    },
    {
      title: 'Một niềm vui chiếm ưu thế',
      message:
        '"{{category}}" chiếm {{percent}}% mọi khoản bạn chi cho giải trí. Hãy tự hỏi nó còn làm bạn vui, hay đã thành thói quen.',
    },
    {
      title: 'Giải trí đang dựa vào "{{category}}"',
      message:
        '{{percent}}% giải trí dồn vào một chỗ. Thứ ta không thể thiếu sẽ nắm giữ ta — hãy xem cái nắm ấy vẫn còn nhẹ không.',
    },
    {
      title: '"{{category}}": {{percent}}% giải trí',
      message:
        'Một nguồn vui duy nhất đang lấy gần hết. Hãy thử sống không có nó một thời gian và xem nó thực sự mang lại gì.',
    },
    {
      title: 'Sự nghỉ ngơi của bạn chỉ có một địa chỉ',
      message:
        'Phần lớn tiền giải trí, {{percent}}%, dành cho “{{category}}”. Bạn chỉ tự do khỏi một thú vui khi có thể sống không có nó.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Một phần chi tiêu chưa được đánh giá',
      message:
        'Danh mục chưa phân loại: {{count}}. Hãy quyết định trong Ngân sách đâu là thiết yếu, công việc, đức hạnh hay giải trí.',
    },
    {
      title: '{{count}} danh mục đang chờ bạn đánh giá',
      message:
        'Chúng có chi tiêu nhưng chưa có nhóm, nên lời khuyên không thể cân nhắc chúng. Một phút trong Ngân sách là xong.',
    },
    {
      title: 'Gọi tên điều đồng tiền của bạn phục vụ',
      message:
        '{{count}} danh mục vẫn chưa được phân loại. Phán đoán bắt đầu từ việc gọi sự vật đúng tên của chúng.',
    },
    {
      title: 'Chi tiêu chưa được đánh giá: {{count}} danh mục',
      message:
        'Đó là nhu cầu, công việc, đức hạnh hay niềm vui? Chỉ bạn mới trả lời được — và kế hoạch sẽ rõ ràng hơn khi bạn trả lời.',
    },
    {
      title: 'Vài danh mục chưa có nhóm',
      message:
        '{{count}} danh mục nằm ngoài bốn nhóm. Hãy phân loại chúng trong Ngân sách để mọi khoản chi được nhìn đúng bản chất.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} lần mua nhỏ tại {{merchant}}',
      message:
        'Từng khoản trông chẳng đáng kể; gộp lại thành {{totalAmount}} trong tháng. Những thói quen nhỏ, không được xem xét, là nơi phần lớn tiền lặng lẽ biến mất.',
    },
    {
      title: '{{merchant}}: {{count}} lần trong một tháng',
      message:
        '{{totalAmount}} bằng những khoản nhỏ. Hãy hỏi mỗi lần ghé là một lựa chọn hay một phản xạ: chỉ lựa chọn mới là tự do.',
    },
    {
      title: 'Góp gió thành bão: {{totalAmount}}',
      message:
        '{{count}} lần mua tại {{merchant}}. Không lần nào quan trọng; thói quen mới quan trọng. Hãy quyết định bạn thực sự muốn nó thường xuyên đến đâu.',
    },
    {
      title: 'Một thói quen tại {{merchant}}',
      message:
        '{{count}} lần mua, tổng cộng {{totalAmount}}. Hãy thử bỏ một trong ba lần và xem bạn có nhớ nó không.',
    },
    {
      title: 'Những điều nhỏ cộng dồn lại',
      message:
        'Bạn đã ghé {{merchant}} {{count}} lần, hết {{totalAmount}}. Làm chủ những quyết định lớn được xây trên những quyết định nhỏ như thế này.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Cuối tuần chiếm {{percent}}% giải trí',
      message:
        'Phần lớn chi tiêu giải trí của bạn rơi vào thứ Bảy và Chủ nhật. Nghỉ ngơi là tốt; hãy chắc rằng đó là nghỉ ngơi chứ không phải bù đắp cho cả tuần.',
    },
    {
      title: 'Giải trí sống vào cuối tuần',
      message:
        '{{percent}}% chi tiêu giải trí rơi vào cuối tuần. Lên kế hoạch cho cuối tuần một chút, nó sẽ tốn ít hơn và mang lại nhiều hơn.',
    },
    {
      title: 'Cuối tuần chi thay cho cả tuần',
      message:
        'Cuối tuần chiếm {{percent}}% những gì bạn chi cho giải trí. Nếu thứ Bảy nào cũng phải sửa chữa cả tuần, hãy nhìn vào chính tuần đó.',
    },
    {
      title: 'Thứ Bảy và Chủ nhật: {{percent}}% giải trí',
      message:
        'Ngày rảnh rỗi dễ mời gọi chi tiêu tùy hứng. Hãy quyết định trước cuối tuần nó dành cho điều gì, và để tiền đi theo.',
    },
    {
      title: 'Một khuôn mẫu cuối tuần',
      message:
        '{{percent}}% chi tiêu giải trí diễn ra vào cuối tuần. Ngày thường thư thả hơn thường khiến cuối tuần bớt tốn kém.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} chiếm {{percent}}% tháng này',
      message:
        '{{totalAmount}} tiền giải trí đã đến một nơi duy nhất. Khi một chỗ lấy nhiều tiền của bạn đến vậy, hãy hỏi nó lấy bao nhiêu sự chú ý của bạn.',
    },
    {
      title: 'Một nơi, {{totalAmount}}',
      message:
        '{{merchant}} chiếm {{percent}}% chi tiêu trong tháng. Nó có xứng với phần ấy trong thành quả lao động của bạn không?',
    },
    {
      title: '{{merchant}} dẫn đầu chi tiêu của bạn',
      message:
        '{{percent}}% của tháng — {{totalAmount}} — đã đến đó. Tận hưởng nó chẳng có gì sai, miễn là bạn sẽ chọn lại nó.',
    },
    {
      title: 'Một phần lớn tại {{merchant}}',
      message:
        '{{totalAmount}}, tức {{percent}}% chi tiêu, ở một nơi giải trí. Hãy bình tĩnh cân niềm vui với cái giá của nó.',
    },
    {
      title: '{{percent}}% tại {{merchant}}',
      message:
        'Chỉ riêng nơi này đã lấy {{totalAmount}}. Tự do là có thể đi ngang qua nó khi bạn muốn.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Thu nhập giảm, chi tiêu thì không',
      message:
        'Thu nhập giảm {{percent}}% còn {{incomeAmount}}, nhưng chi tiêu vẫn ở mức {{expenseAmount}}. Vận may đã đổi ý; chi tiêu của bạn thì chưa nhận ra.',
    },
    {
      title: 'Thu nhập giảm {{percent}}%',
      message:
        'Tiền vào {{incomeAmount}}, tiền ra {{expenseAmount}}. Vận may cho gì thì cũng có thể lấy lại — hãy điều chỉnh chi tiêu theo hiện tại, không theo quá khứ.',
    },
    {
      title: 'Tháng eo hẹp hơn, thói quen vẫn thế',
      message:
        'Thu nhập thấp hơn {{percent}}% ({{incomeAmount}}), trong khi chi tiêu giữ ở {{expenseAmount}}. Thu nhập không nằm trong tầm tay bạn; cách phản ứng thì có.',
    },
    {
      title: 'Vận may đã đổi chiều',
      message:
        'Bạn kiếm ít hơn thường lệ {{percent}}%, nhưng vẫn chi {{expenseAmount}} như trước. Hãy cắt giảm ngay, khi đó còn là lựa chọn chứ chưa phải điều bắt buộc.',
    },
    {
      title: 'Chi tiêu chưa theo kịp thu nhập',
      message:
        'Thu nhập giảm còn {{incomeAmount}} (giảm {{percent}}%); chi tiêu là {{expenseAmount}}. Hãy chỉnh cánh buồm theo đúng ngọn gió bạn đang có.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Gói đăng ký: {{monthlyAmount}} mỗi tháng',
      message:
        '{{count}} gói đăng ký chiếm {{percent}}% chi tiêu hằng tháng. Gói nào cũng tự gia hạn mà không hỏi bạn — vậy hãy tự hỏi về từng gói.',
    },
    {
      title: '{{percent}}% chi tiêu tự gia hạn',
      message:
        '{{count}} gói đăng ký, {{monthlyAmount}} mỗi tháng. Chỉ giữ những gói mà hôm nay bạn vẫn sẽ đăng ký lại.',
    },
    {
      title: 'Lặng lẽ, định kỳ, {{monthlyAmount}}',
      message:
        '{{count}} gói đăng ký tốn {{percent}}% tháng của bạn. Sự tiện lợi là người đầy tớ tốt nhưng là ông chủ đắt giá.',
    },
    {
      title: '{{count}} gói đăng ký cần xem lại',
      message:
        'Cộng lại là {{monthlyAmount}} mỗi tháng, {{percent}}% chi tiêu. Hủy một gói bạn hầu như không dùng và xem mình ít nhớ nó đến mức nào.',
    },
    {
      title: 'Những gì tự gia hạn',
      message:
        '{{monthlyAmount}} mỗi tháng cho {{count}} gói đăng ký. Chi tiêu tự động xứng đáng được xem xét có chủ đích.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Thành công của bạn có thể lan xa hơn một chút',
      message:
        'Trong {{months}} tháng, bạn giữ lại {{savingsPercent}}% thu nhập, nhưng gần như không có gì đến với người khác. Của cải nằm yên nhất trong đôi tay rộng mở — tháng này có lẽ là một món quà hay một khoản quyên góp?',
    },
    {
      title: 'Kiếm tốt, cho đi ít',
      message:
        'Trong {{months}} tháng, thu nhập là {{incomeAmount}} và phần dành cho người khác là {{givenAmount}}. Nếu bạn giúp đỡ theo cách mà ứng dụng này không thấy, hãy bỏ qua; nếu không, kế hoạch vẫn còn chỗ cho điều đó.',
    },
    {
      title: 'Một thời điểm tốt để rộng lượng',
      message:
        'Bạn đã tiết kiệm {{savingsPercent}}% thu nhập — dấu hiệu của một bàn tay vững vàng. Trao một phần nhỏ trong đó cho người đang cần sẽ khiến sự vững vàng ấy thêm ý nghĩa.',
    },
    {
      title: 'Chưa có ai khác trong bức tranh',
      message:
        '{{months}} tháng gần nhất cho thấy bạn kiếm tiền và tiết kiệm cẩn thận, nhưng không có khoản từ thiện hay quà tặng nào. Chúng ta sinh ra là vì nhau; một món quà khiêm tốn là đủ để bắt đầu.',
    },
    {
      title: 'Chỗ cho lòng tốt',
      message:
        'Chỉ {{givenAmount}} trong {{incomeAmount}} được dùng để giúp người khác. Hãy cân nhắc một khoản quyên góp nhỏ, đều đặn — như mọi đức tính, sự rộng lượng dễ dần lên nhờ thói quen.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '"{{goal}}" đang chậm tiến độ',
      message:
        'Mục tiêu cần {{requiredAmount}} mỗi tháng, và bạn đang góp khoảng {{paceAmount}}. Với nhịp này nó sẽ đến muộn {{monthsLate}} tháng. Nhịp độ nằm trong tầm tay bạn.',
    },
    {
      title: '"{{goal}}": muộn {{monthsLate}} tháng với nhịp này',
      message:
        'Cần {{requiredAmount}} mỗi tháng, thực tế khoảng {{paceAmount}}. Hãy dời ngày một cách trung thực hoặc dồn thêm tiền một cách có chủ đích.',
    },
    {
      title: 'Mục tiêu và nhịp độ không khớp',
      message:
        '"{{goal}}" cần {{requiredAmount}} mỗi tháng; nó nhận {{paceAmount}}. Một mục tiêu chỉ thật khi có bước đi hằng tháng hướng về nó.',
    },
    {
      title: '"{{goal}}" cần một bước chắc hơn',
      message:
        '{{paceAmount}} mỗi tháng so với {{requiredAmount}} cần có. Tháng sau hãy góp cho mục tiêu trước, trước mọi khoản không bắt buộc.',
    },
    {
      title: 'Chậm tiến độ với "{{goal}}"',
      message:
        'Nhịp hiện tại ({{paceAmount}}/tháng) khiến nó muộn {{monthsLate}} tháng. Điều nằm trong tầm tay bạn là bước kế tiếp, không phải cả con đường.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '"{{goal}}" không vừa với kế hoạch',
      message:
        'Mục tiêu cần {{requiredAmount}} mỗi tháng, nhưng sau các ngân sách chỉ còn {{freeAmount}}. Hãy đổi ngày, đổi mục tiêu hoặc đổi ngân sách — hy vọng không phải là kế hoạch.',
    },
    {
      title: '"{{goal}}" đòi hỏi nhiều hơn phần bạn còn trống',
      message:
        'Cần {{requiredAmount}} mỗi tháng, có sẵn {{freeAmount}}. Muốn mọi thứ cùng lúc là cách để chẳng làm xong gì; hãy chọn.',
    },
    {
      title: 'Các con số nói "chưa" — lúc này',
      message:
        '"{{goal}}" cần {{requiredAmount}} mỗi tháng; tiền trống của bạn là {{freeAmount}}. Hãy điều chỉnh điều trong tầm tay: thời hạn hoặc các giới hạn khác.',
    },
    {
      title: '"{{goal}}" cần một quyết định',
      message:
        'Với {{requiredAmount}} mỗi tháng, nó vượt quá {{freeAmount}} còn lại sau các ngân sách. Một mục tiêu chọn với đôi mắt mở tốt hơn một mục tiêu giữ bằng mơ tưởng.',
    },
    {
      title: 'Nhịp độ bất khả cho "{{goal}}"',
      message:
        'Cần {{requiredAmount}} mỗi tháng, còn trống {{freeAmount}}. Tính toán trung thực bây giờ giúp tránh thất vọng về sau.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Số dư xuống dưới 0 vào {{date}}',
      message:
        'Với thu nhập và chi tiêu như hiện nay, số dư dự báo xuống tới {{lowestAmount}}. Hãy chuẩn bị ngay bây giờ, khi nó mới chỉ là dự báo.',
    },
    {
      title: 'Sắp thiếu hụt: {{date}}',
      message:
        'Các khoản thanh toán và chi tiêu hằng ngày vượt quá tiền vào, chạm đáy ở {{lowestAmount}}. Lường trước khó khăn là cách làm nó mất sức mạnh.',
    },
    {
      title: 'Lên kế hoạch cho {{date}}',
      message:
        'Vào ngày đó số dư dự kiến chạm {{lowestAmount}}. Dời một khoản thanh toán, gác lại một mong muốn, hoặc để riêng tiền mặt — điều nào cũng nằm trong tầm tay bạn hôm nay.',
    },
    {
      title: 'Dự báo rơi xuống dưới 0',
      message:
        'Số dư giảm xuống {{lowestAmount}} vào khoảng {{date}}. Cách ứng phó bình tĩnh là ứng phó sớm.',
    },
    {
      title: 'Lường trước khoảng hụt vào {{date}}',
      message:
        'Số dư thấp nhất dự kiến: {{lowestAmount}}. Điều được thấy trước có thể đón nhận bằng sự điềm tĩnh; điều bất ngờ thì hiếm khi.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Bạn đã giữ lời với chính mình',
      message:
        '{{months}} tháng liên tiếp, chi tiêu của bạn nằm trong kế hoạch bạn tự đặt ra. Tự chủ trông như thế đấy.',
    },
    {
      title: '{{months}} tháng trong kế hoạch',
      message:
        'Tháng này qua tháng khác, điều bạn định và điều bạn làm luôn khớp nhau. Sự bền bỉ lặng lẽ hơn ý chí và bền lâu hơn.',
    },
    {
      title: 'Kế hoạch và cuộc sống đồng điệu',
      message:
        '{{months}} tháng liên tiếp trong giới hạn. Một kế hoạch được giữ tốt đến vậy không còn là ràng buộc — nó là cách bạn sống.',
    },
    {
      title: 'Vững vàng suốt {{months}} tháng',
      message:
        'Ngân sách của bạn đã đứng vững {{months}} tháng liền. Giữ nguyên sự chú tâm ấy; nó đang hiệu quả.',
    },
    {
      title: 'Kỷ luật được duy trì',
      message:
        '{{months}} tháng không phá kế hoạch. Ít điều nào mang lại tự do bằng việc tin vào quyết định của chính mình.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Tiền của bạn đi theo giá trị của bạn',
      message:
        'Tiền phục vụ đức hạnh chiếm {{actual}}% chi tiêu của bạn, không ít hơn {{planned}}% đã dự định. Tiêu rất đáng.',
    },
    {
      title: 'Đức hạnh nhận đủ phần của mình',
      message:
        '{{actual}}% cho sức khỏe, học tập và người khác, so với {{planned}}% dự định. Điều bạn coi trọng, bạn đã trả tiền cho nó.',
    },
    {
      title: 'Chi để trở nên tốt hơn',
      message:
        'Sức khỏe, học tập và những người khác nhận {{actual}}% chi tiêu trong tháng (dự định {{planned}}%). Đức hạnh không mua được, nhưng có thể phụng sự.',
    },
    {
      title: 'Ý định đã thành hành động',
      message:
        'Bạn dự định {{planned}}% cho đức hạnh và đã chi {{actual}}%. Ý tốt hiếm khi trụ được qua một tháng — ý tốt của bạn thì có.',
    },
    {
      title: 'Cách dùng tiền tốt nhất',
      message:
        '{{actual}}% đã dành cho những điều giúp bạn và người khác tốt hơn. Hãy tiếp tục chọn như vậy.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Giải trí đúng chỗ của nó',
      message:
        'Giải trí chiếm {{actual}}% chi tiêu, dưới mức {{planned}}% bạn cho phép. Bạn tận hưởng mọi thứ mà không bị chúng chi phối.',
    },
    {
      title: 'Niềm vui, giữ đúng cỡ',
      message:
        'Giải trí chiếm {{actual}}% so với {{planned}}% dự định. Điều độ không phải là bỏ lỡ — mà là lựa chọn.',
    },
    {
      title: 'Nghỉ ngơi không quá đà',
      message:
        '{{actual}}% cho giải trí, dưới giới hạn {{planned}}% của bạn. Niềm vui ngon hơn khi nó không nắm quyền.',
    },
    {
      title: 'Tiết độ, một cách lặng lẽ',
      message:
        'Bạn dành cho giải trí {{planned}}% và nó chỉ dùng {{actual}}%. Khoảng dư ấy là tự do bạn đã giữ lại.',
    },
    {
      title: 'Giải trí dưới kế hoạch',
      message:
        'Ở mức {{actual}}% chi tiêu, giải trí nằm dưới {{planned}}% bạn đặt ra. Giữ vững lắm.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: 'Dưới kế hoạch {{percent}}%',
      message:
        'Bạn chi ít hơn {{savedAmount}} so với mức bạn tự cho phép trong tháng. Không cần mọi thứ mình có thể có là một dạng giàu có.',
    },
    {
      title: 'Còn lại {{savedAmount}} chưa tiêu',
      message: 'Tháng này thấp hơn kế hoạch {{percent}}%. Số tiền chưa tiêu vẫn do bạn định hướng.',
    },
    {
      title: 'Ít hơn mức bạn cho phép',
      message:
        'Chi tiêu thấp hơn kế hoạch {{percent}}% — giữ lại {{savedAmount}}. Hãy cho khoản dư ấy một mục đích trước khi thói quen chiếm lấy nó.',
    },
    {
      title: 'Kế hoạch vẫn còn dư',
      message:
        'Thấp hơn giới hạn {{savedAmount}} trong tháng. Sự tiết chế đến dễ dàng là thứ bền lâu.',
    },
    {
      title: 'Nhẹ hơn dự định',
      message:
        'Bạn cần ít hơn {{percent}}% so với ngân sách. Hãy cân nhắc chuyển {{savedAmount}} ấy cho một mục tiêu.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '"{{goal}}" đúng tiến độ',
      message:
        'Bạn đã đi được {{percent}}% chặng đường, đúng nhịp mục tiêu cần. Những bước đều đặn mỗi tháng sẽ đi rất xa.',
    },
    {
      title: 'Đúng hướng với "{{goal}}"',
      message:
        'Đã xong {{percent}}% và nhịp độ vẫn giữ. Hãy tiếp tục góp cho mục tiêu trước; nó đang hiệu quả.',
    },
    {
      title: '"{{goal}}": {{percent}}% và đều đặn',
      message: 'Mục tiêu nhận đủ những gì nó cần mỗi tháng. Sự kiên nhẫn đang làm việc của nó.',
    },
    {
      title: 'Mục tiêu tiến như kế hoạch',
      message:
        '"{{goal}}" đã được góp {{percent}}% và đúng hạn. Điều được làm từng chút mỗi tháng không thể bị một tuần tệ hại ngăn lại.',
    },
    {
      title: 'Tiến bộ đáng tin cậy',
      message:
        '"{{goal}}" đạt {{percent}}%, đúng nhịp. Bạn đang xây nó theo cách duy nhất hiệu quả — từ từ.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Ít mua bốc đồng hơn tại {{merchant}}',
      message:
        'Từ {{before}} lần mua trong một tháng xuống còn khoảng {{after}}. Một thói quen được nới lỏng là tự do giành được.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Bạn ghé ít hơn trước. Mỗi phản xạ được bỏ qua là một chiến thắng nhỏ của lựa chọn trước thói quen.',
    },
    {
      title: 'Thói quen nhỏ đang thu hẹp',
      message:
        'Số lần mua tại {{merchant}} giảm từ {{before}} xuống khoảng {{after}}. Cứ tiếp tục — mọi thứ sẽ dễ dần.',
    },
    {
      title: 'Lựa chọn thay cho phản xạ',
      message:
        'Tại {{merchant}}, bạn đi từ {{before}} lần mua xuống khoảng {{after}}. Đó là sự làm chủ được xây từng quyết định một.',
    },
    {
      title: 'Bớt những khoản lặt vặt',
      message:
        'Bạn ghé {{merchant}} khoảng {{after}} lần thay vì {{before}}. Những chiến thắng nhỏ sẽ cộng dồn.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Bạn đã thích nghi với tháng eo hẹp',
      message:
        'Thu nhập giảm {{incomePercent}}%, và bạn cắt chi tiêu {{expensePercent}}%. Bạn đáp lại sự đổi thay của vận may bằng một sự đổi hướng.',
    },
    {
      title: 'Điềm tĩnh khi thu nhập giảm',
      message:
        'Thu nhập giảm {{incomePercent}}%, chi tiêu giảm {{expensePercent}}%. Bạn điều chỉnh theo hiện tại, không theo quá khứ.',
    },
    {
      title: 'Vận may đổi thay; bạn cũng vậy',
      message:
        'Thu nhập giảm {{incomePercent}}% đã gặp chi tiêu giảm {{expensePercent}}%. Đó là sự bình thản bằng con số.',
    },
    {
      title: 'Cầm lái vững vàng',
      message:
        'Khi thu nhập giảm {{incomePercent}}%, chi tiêu cũng theo sau (ít hơn {{expensePercent}}%). Ngọn gió không thuộc về bạn; cánh buồm thì có.',
    },
    {
      title: 'Chi tiêu giảm theo thu nhập',
      message:
        'Bạn chi ít hơn {{expensePercent}}% khi thu nhập giảm {{incomePercent}}%. Thích nghi sớm là cách đi qua một cách bình tĩnh.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Thiết yếu ổn định',
      message:
        'Suốt {{months}} tháng, chi phí thiết yếu của bạn hầu như không đổi. Một mức sàn ổn định cho bạn tự do phía trên nó.',
    },
    {
      title: 'Nhu cầu được giữ trong tầm kiểm soát',
      message:
        'Chi tiêu thiết yếu đi ngang {{months}} tháng. Nhu cầu không lớn thêm là nhu cầu bạn làm chủ.',
    },
    {
      title: '{{months}} tháng thiết yếu ổn định',
      message:
        'Tiền nhà, ăn uống và hóa đơn vẫn giữ nguyên. Sự ổn định lặng lẽ cũng là một thành tựu.',
    },
    {
      title: 'Thiết yếu không lặng lẽ tăng',
      message:
        '{{months}} tháng không trôi dạt ở những gì cuộc sống đòi hỏi. Trên nền tảng ấy, mọi thứ khác dễ lên kế hoạch hơn.',
    },
    {
      title: 'Một mức sàn vững chắc',
      message:
        'Chi tiêu thiết yếu ổn định đã {{months}} tháng. Bạn không để tiện nghi đội lốt nhu cầu.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Rộng lượng với những gì bạn kiếm được',
      message:
        'Trong {{months}} tháng, {{percent}}% thu nhập của bạn — {{givenAmount}} — đã dùng để giúp người khác. Đó là đồng tiền được dùng đúng chỗ nhất.',
    },
    {
      title: 'Đã trao cho người khác {{givenAmount}}',
      message:
        'Bạn đã chia sẻ {{percent}}% thu nhập trong {{months}} tháng. Lòng tốt hiện lên trong những con số là lòng tốt được thực hành, không chỉ được cảm nhận.',
    },
    {
      title: 'Đôi tay rộng mở',
      message:
        'Gần đây từ thiện và quà tặng chiếm {{percent}}% thu nhập của bạn. Những gì bạn cho đi là phần của cải mà không rủi ro nào lấy mất được.',
    },
    {
      title: 'Rộng lượng là một phần kế hoạch của bạn',
      message:
        '{{givenAmount}} cho người khác trong {{months}} tháng. Hãy giữ như vậy — điều tốt bạn làm cho người khác cũng là điều tốt làm cho chính mình.',
    },
    {
      title: 'Cho đi đúng chỗ',
      message:
        '{{percent}}% số tiền bạn kiếm được đã dùng để giúp người khác. Hiếm có thói quen nào nói lên nhiều hơn về một con người.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Không có gì cần sửa',
      message: 'Chi tiêu của bạn khớp với những gì bạn dự định. Cứ tiếp tục như vậy.',
    },
    {
      title: 'Ý định và hành động đồng nhất',
      message: 'Tháng này trông đúng như bạn đã lên kế hoạch. Sự khớp ấy chính là mục đích.',
    },
    {
      title: 'Một tháng bình lặng',
      message:
        'Không có gì quá đà, không có gì bị bỏ bê đáng kể. Làm tốt lắm — hãy mang sự chú tâm ấy sang tháng sau.',
    },
    {
      title: 'Mọi thứ đều ổn',
      message:
        'Kế hoạch đã đứng vững và không có gì cần điều chỉnh. Hãy tận hưởng sự yên tĩnh bạn đã giành được.',
    },
    {
      title: 'Bàn tay vững vàng',
      message:
        'Tháng này đi theo kế hoạch của bạn. Thói quen tốt khiến những tháng tốt trông thật bình thường.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Giữ phần của mình trước',
      message:
        'Trong {{months}} tháng, bạn giữ lại {{savingsPercent}}% thu nhập. Lời cảnh báo của Seneca: tiết kiệm khi đã chạm đáy thùng thì quá muộn. Hãy để riêng {{tenthAmount}} ngay ngày thu nhập về.',
    },
    {
      title: 'Tiết kiệm từ miệng thùng',
      message:
        'Chỉ {{savingsPercent}}% thu nhập còn lại với bạn. Sự tằn tiện chờ đến phần dư thì đến quá muộn; {{tenthAmount}} mỗi tháng, để riêng trước tiên, bắt đầu nó ngay từ bây giờ.',
    },
    {
      title: 'Cái gì là của bạn, hãy giữ lấy',
      message:
        'Seneca khuyên giữ lấy những gì thực sự là của mình và bắt đầu sớm. Gần đây {{savingsPercent}}% thu nhập còn lại với bạn; hãy bắt đầu với {{tenthAmount}} vào ngày nhận lương và để chi tiêu vừa với phần còn lại.',
    },
    {
      title: 'Bắt đầu trước khi chạm cặn',
      message:
        'Bạn giữ được {{savingsPercent}}% trong {{months}} tháng. Tiết kiệm nằm trong tầm tay chỉ khi còn gì để tiết kiệm: hãy để riêng {{tenthAmount}} trước mọi thứ khác.',
    },
    {
      title: 'Giữ được {{savingsPercent}}%, mà thùng đang cạn',
      message:
        '{{tenthAmount}} mỗi tháng, một phần mười thu nhập, để riêng trước mọi hóa đơn. Điều bạn giữ trước không phụ thuộc vào phần tháng ấy để lại.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Chuẩn bị khi trời còn yên',
      message:
        'Khoản dự phòng của bạn đủ cho khoảng {{cushionDays}} ngày chi tiêu. Seneca nói: tâm hồn nên tự tôi luyện trong những lúc không lo âu. Ba tháng chi tiêu là {{targetAmount}}.',
    },
    {
      title: 'Dự phòng {{cushionDays}} ngày',
      message:
        'Vận may không báo trước. Hãy hướng tới {{targetAmount}}, ba tháng chi tiêu, khi chưa có gì thúc ép: lúc ấy việc này dễ dàng.',
    },
    {
      title: '“Đây có phải là cảnh ngộ mà ta từng sợ hãi không?”',
      message:
        'Seneca bảo Lucilius tập sống nghèo để nỗi sợ ấy mất đi sức nặng. Với dự phòng {{cushionDays}} ngày, một tháng khó khăn sẽ không còn là buổi tập. Hãy hướng tới {{targetAmount}}.',
    },
    {
      title: 'Lường trước tháng khó',
      message:
        'Khoản tiết kiệm của bạn đủ cho khoảng {{cushionDays}} ngày. Điều đã lường trước đến nhẹ nhàng; {{targetAmount}} sẽ đỡ bạn qua ba tháng.',
    },
    {
      title: 'Dựng tường trước khi bão tới',
      message:
        'Khoảng {{cushionDays}} ngày đã được bảo đảm. Mất thu nhập không nằm trong tầm tay bạn; khoản dự phòng thì có. Ba tháng chi tiêu là {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Ham muốn chạy nhanh hơn thu nhập',
      message:
        'Chi tiêu tăng {{expenseGrowth}}% trong quý vừa qua, còn thu nhập thay đổi {{incomeGrowth}}%. Seneca viết: nghèo không phải là người có quá ít, mà là người thèm muốn nhiều hơn.',
    },
    {
      title: 'Sống cao hơn, không phải tốt hơn',
      message:
        'Chi tiêu tăng {{expenseGrowth}}%, thu nhập tăng {{incomeGrowth}}%. Nhu cầu của tự nhiên thì ít ỏi; đòi hỏi của dư luận thì vô bờ. Hãy hỏi mức tăng này phục vụ cái nào.',
    },
    {
      title: 'Ham muốn đã lớn: +{{expenseGrowth}}%',
      message:
        'Chi tiêu tăng nhanh hơn thu nhập ({{incomeGrowth}}%). Một tiện nghi mới chẳng mấy chốc trông như nhu cầu: hãy nhận ra nó khi còn có thể từ chối.',
    },
    {
      title: 'Ranh giới đang dịch chuyển',
      message:
        'Chi tiêu tăng {{expenseGrowth}}% so với quý trước, thu nhập tăng {{incomeGrowth}}%. Đủ chỉ còn là đủ khi chính bạn quyết định đủ là bao nhiêu.',
    },
    {
      title: 'Nhiều hơn không phải là thuốc chữa',
      message:
        'Trong quý vừa qua chi tiêu tăng {{expenseGrowth}}% và thu nhập tăng {{incomeGrowth}}%. Của cải lớn theo ham muốn thì không bao giờ tới nơi; hãy đặt giới hạn trước khi điều này thành mức bình thường mới.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} tốn của bạn {{hours}} giờ cuộc đời',
      message:
        'Seneca nhắc rằng chỉ có thời gian thực sự là của ta. {{totalAmount}} ở {{merchant}} là khoảng {{hours}} giờ làm việc của bạn. Có đáng không?',
    },
    {
      title: '{{hours}} giờ ở {{merchant}}',
      message:
        'Ta giữ chặt tiền mà đem thời gian cho đi. Với thu nhập theo giờ trung bình của bạn, {{totalAmount}} ở đó là khoảng {{hours}} giờ làm việc.',
    },
    {
      title: 'Tính giá bằng giờ',
      message:
        '{{totalAmount}} ở {{merchant}} là khoảng {{hours}} giờ làm việc. Giờ là thứ duy nhất bạn không thể kiếm lại.',
    },
    {
      title: '{{merchant}} thực sự tốn bao nhiêu',
      message:
        'Bạn đổi ngày tháng lấy tiền, rồi đổi tiền lấy đồ vật. {{merchant}} đã lấy khoảng {{hours}} giờ của bạn ({{totalAmount}}). Niềm vui có xứng với những giờ ấy không?',
    },
    {
      title: 'Cân nhắc những giờ ấy',
      message:
        'Quy đổi theo thu nhập theo giờ trung bình của bạn, {{totalAmount}} ở {{merchant}} là khoảng {{hours}} giờ. Ta đánh mất rất nhiều thời gian của mình, Seneca viết. Bạn có chọn điều này không?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'Quy tắc “{{rule}}” đã lạc đường',
      message:
        'Nó chỉ vào thứ không còn tồn tại, nên đã lặng lẽ ngừng hoạt động. Hãy sửa hoặc xóa nó: trật tự chẳng làm gì chỉ trông giống trật tự.',
    },
    {
      title: '“{{rule}}” không còn tác dụng',
      message:
        'Danh mục, tài khoản hoặc người nhận của nó đã mất, và quy tắc giờ bị bỏ qua ở mọi giao dịch. Hãy nhìn sự việc như nó vốn là, rồi sửa.',
    },
    {
      title: 'Một quy tắc nhắm vào hư không',
      message:
        '“{{rule}}” đưa giao dịch tới nơi đã bị xóa. Bạn từng quyết định một điều; hãy quyết định lại, bây giờ khi mọi thứ đã đổi.',
    },
    {
      title: '“{{rule}}” cần phán đoán của bạn',
      message:
        'Thứ nó nhắc tới đã bị xóa, và các giao dịch nó từng phân loại giờ đang chờ bạn. Hãy cho nó một mục tiêu mới hoặc buông nó đi.',
    },
    {
      title: 'Một quy tắc hỏng, trong im lặng',
      message:
        '“{{rule}}” không làm gì và cũng không nói gì về điều đó. Hãy sửa những gì trong tầm tay: chỉ mất một phút.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Tay bạn không đồng ý với “{{rule}}”',
      message:
        '{{count}} lần bạn tự phân loại sang chỗ khác điều mà quy tắc này phân loại khác đi. Hoặc quy tắc sai, hoặc bàn tay sai: hãy quyết định bên nào.',
    },
    {
      title: '“{{rule}}” bị gạt đi {{count}} lần',
      message:
        'Quy tắc mà bạn cứ phải sửa thì không còn là một quyết định, chỉ là thói quen tranh cãi với chính mình. Hãy đổi nó hoặc tin nó.',
    },
    {
      title: 'Nói điều bạn làm, làm điều bạn nói',
      message:
        'Quy tắc “{{rule}}” nói một đằng, {{count}} lần sửa gần nhất của bạn nói một nẻo. Hãy làm cho hai bên khớp nhau.',
    },
    {
      title: 'Một quyết định đang bị tranh cãi',
      message:
        'Bạn đặt “{{rule}}” khi đầu óc sáng suốt, và từ đó {{count}} giao dịch đã đi theo hướng khác. Hãy nhìn lại, bình tĩnh, xem bên nào đúng.',
    },
    {
      title: '{{count}} lần sửa ngược lại “{{rule}}”',
      message: 'Sự lặp lại là thông tin. Hãy để nó đổi quy tắc, hoặc để quy tắc đổi thói quen.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Quyết một lần về {{payee}}',
      message:
        'Bạn đã tự phân loại {{payee}} {{decided}} lần, lần nào cũng giống nhau. Điều gì bạn cứ quyết đi quyết lại, hãy quyết một lần, với đầu óc sáng suốt.',
    },
    {
      title: 'Một quyết định đã đưa ra {{decided}} lần',
      message:
        '{{payee}} cứ hỏi cùng một câu và bạn cứ đưa cùng một câu trả lời. Một quy tắc sẽ giữ sự chú ý của bạn cho những gì thực sự cần đến nó.',
    },
    {
      title: 'Người nhận đã sẵn sàng cho quy tắc: {{count}}',
      message:
        'Những người nhận giống nhau cứ được bạn xếp vào cùng một danh mục, nhiều nhất là {{payee}}. Hãy để dành phán đoán cho những gì mới.',
    },
    {
      title: 'Thói quen của bạn sẵn sàng thành nguyên tắc',
      message:
        'Bạn phân loại {{payee}} giống nhau mỗi lần (đến nay {{decided}} lần). Hãy viết nó thành quy tắc và nó sẽ giữ vững mà không tốn sức.',
    },
    {
      title: 'Hãy để một quy tắc gánh việc này',
      message:
        'Số người nhận bạn luôn phân loại giống nhau: {{count}}, trong đó {{payee}} có {{decided}} giao dịch. Một nguyên tắc đã định một lần thì không phải bàn lại.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” không gặp gì suốt {{months}} tháng',
      message:
        'Hoặc thế giới mà nó được lập cho đã qua, hoặc điều kiện của nó trượt mục tiêu. Hãy giữ quy tắc của bạn đúng thực: sửa hoặc xóa nó.',
    },
    {
      title: 'Một quy tắc đang nghỉ: “{{rule}}”',
      message:
        'Nó không chạm vào giao dịch nào suốt {{months}} tháng. Hãy gạt bỏ điều thừa; phần còn lại sẽ dễ tin hơn.',
    },
    {
      title: '“{{rule}}” đứng không',
      message:
        '{{months}} tháng không khớp lần nào trong khi giao dịch mới vẫn đến. Hãy thử nó trên các giao dịch gần đây, rồi quyết định.',
    },
    {
      title: '“{{rule}}” còn cần không?',
      message:
        'Suốt {{months}} tháng không có gì khớp với nó. Giữ một quy tắc vì thói quen là thêm một thứ phải chăm lo.',
    },
    {
      title: 'Một quyết định không có gì để quyết',
      message:
        '“{{rule}}” im lặng suốt {{months}} tháng. Trật tự là có những gì mình cần, và chỉ vậy thôi.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Các quyết định của bạn đang đứng vững',
      message:
        'Quy tắc đã phân loại {{percent}}% giao dịch trong tháng, và bạn không phải sửa lại cái nào. Một quyết định đã đưa ra một lần và giữ được sẽ giải phóng tâm trí.',
    },
    {
      title: '{{percent}}% đã xong từ trước',
      message:
        'Phần lớn giao dịch trong tháng được phân loại theo những gì bạn đã quyết trước đó. Đó là sự chú ý tiết kiệm được cho điều quan trọng.',
    },
    {
      title: 'Nguyên tắc đang làm việc',
      message:
        'Quy tắc của bạn xử lý {{percent}}% giao dịch mà không tranh cãi. Nguyên tắc đã vững tạo ra những ngày yên tĩnh.',
    },
    {
      title: 'Ít việc phải quyết hơn',
      message:
        '{{percent}}% giao dịch không cần quyết định mới. Bạn đã phán đoán một lần, đúng, và phán đoán ấy vẫn còn đứng.',
    },
    {
      title: 'Trật tự được giữ',
      message:
        'Quy tắc đã phân loại {{percent}}% giao dịch trong tháng, và không cái nào bị bác bỏ. Trật tự tốt trông như không có gì xảy ra.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” chưa có ngày',
      message:
        'Nó đang ở {{percent}}% mà không có gì được góp vào. Người không biết mình đang hướng tới bến nào thì gió nào cũng không thuận: hãy nêu ngày bạn định cập bến.',
    },
    {
      title: 'Một điều ước hay một mục tiêu?',
      message:
        '“{{goal}}” không có hạn chót và không có nhịp độ. Mục tiêu là một quyết định có ngày tháng; hãy cho nó một ngày hoặc buông nó đi.',
    },
    {
      title: 'Hãy chọn ngày cho “{{goal}}”',
      message:
        'Nó đã đi được {{percent}}% và đứng yên. Việc làm được vào lúc nào cũng được thì hiếm khi được làm.',
    },
    {
      title: '“{{goal}}” chờ “một ngày nào đó”',
      message:
        'Gần đây chưa có gì được góp vào, và không có ngày nào đòi hỏi gì. “Một ngày nào đó” không có trong lịch của bạn; hãy chọn một ngày có.',
    },
    {
      title: '“{{goal}}” chưa có bến',
      message:
        'Ở {{percent}}%, không có hạn chót. Biết mình đang đi đâu, thì bước đi hằng tháng sẽ tự đến.',
    },
  ],
};
