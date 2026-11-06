import type { StoicTextMap } from './types';

export const zh: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: '本月超出了计划',
      message:
        '您计划花 {{plannedAmount}}，实际已花 {{spentAmount}}，多出 {{percent}}%。计划是在头脑清醒时定下的，让它的声音盖过一时的冲动。',
    },
    {
      title: '比打算多花了 {{percent}}%',
      message:
        '支出已达 {{spentAmount}}，而计划是 {{plannedAmount}}。看看哪个限度最先失守——教训就在那里。',
    },
    {
      title: '计划与这个月意见不合',
      message:
        '已花 {{spentAmount}}，原打算 {{plannedAmount}}。要么计划对现实要求太少，要么现实对您要求太多——冷静地判断是哪一种。',
    },
    {
      title: '花出去的比您允许的多',
      message:
        '本月比您设定的 {{plannedAmount}} 超出了 {{percent}}%。现在停下，什么也不会失去；假装没发生，失去的会很多。',
    },
    {
      title: '自己定的限度，自己越过了',
      message:
        '您本想花 {{plannedAmount}}，实际是 {{spentAmount}}。自制不是从不失足，而是及早察觉、回到正路。',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: '休闲花得比计划多',
      message:
        '您原打算让休闲占支出的 {{planned}}%，实际是 {{actual}}%。快乐作为客人很好，但不该成为一家之主。',
    },
    {
      title: '休闲 {{actual}}%，计划 {{planned}}%',
      message:
        '休息若能让人恢复，便值得。问问这段时间的享乐里哪些真正让您恢复了，其余的不必遗憾地放下。',
    },
    {
      title: '安逸正在超过意图',
      message:
        '休闲占支出的 {{actual}}%，而您选择的是 {{planned}}%。节制不是拒绝快乐，而是让快乐保持您决定的分量。',
    },
    {
      title: '舒适挤占了计划',
      message:
        '您给休闲的是计划的 {{planned}}%，它却拿走了 {{actual}}%。轻易就能享受的东西，在它变成必需之前值得再看一眼。',
    },
    {
      title: '休闲越过了界线',
      message: '本月 {{actual}}% 用于休闲，本意是 {{planned}}%。界线由您划定，也由您守住。',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: '休闲再次超出计划',
      message:
        '在最近 {{window}} 个月中，休闲有 {{months}} 个月超出计划。重复就不再是偶然，而是值得审视的习惯。',
    },
    {
      title: '{{window}} 个月中有 {{months}} 个月休闲超计划',
      message: '发生一次是境遇；发生 {{months}} 次，就是正在成形的品性。请有意识地选择这种品性。',
    },
    {
      title: '同样的失误，一月又一月',
      message:
        '{{window}} 个月里有 {{months}} 个月休闲超出计划。要么诚实地提高计划，要么改变习惯——夹在两者之间代价最大。',
    },
    {
      title: '这是模式，不是偶然失误',
      message:
        '最近 {{window}} 个月中有 {{months}} 个月，休闲拿走的比您给的多。留意做决定的那一刻，而不只是事后的账单。',
    },
    {
      title: '习惯正在投票反对您的计划',
      message:
        '{{window}} 个月里休闲 {{months}} 次胜过计划。习惯是一次次选择建立起来的，改掉它也是如此。',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: '美德得到的比预想少',
      message:
        '您原计划把预算的 {{planned}}% 留给健康、学习等方面，实际只有 {{actual}}%。意图要付诸实行，才算数。',
    },
    {
      title: '美德 {{actual}}%，计划 {{planned}}%',
      message:
        '您打算用在让自己变得更好的事情上的钱，仍在等待。把它花得好，没有比现在更合适的时候。',
    },
    {
      title: '您计划的善事还没花出去',
      message:
        '健康、学习和慷慨本应占支出的 {{planned}}%，实际只有 {{actual}}%。这周就有意识地做其中一件。',
    },
    {
      title: '有意图，无行动',
      message:
        '美德占支出的 {{actual}}%，而您选择的是 {{planned}}%。我们珍视什么，体现在我们真正为什么付钱。',
    },
    {
      title: '还有空间留给重要的事',
      message:
        '虽然计划了 {{planned}}%，美德只得到 {{actual}}%。一本书、一次体检、一份给需要之人的礼物——计划早已同意。',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: '美德一再被推迟',
      message:
        '健康、学习和他人方面的支出已连续 {{months}} 个月低于计划。一直推迟的事，实际上您已经放弃了。',
    },
    {
      title: '推迟美德已 {{months}} 个月',
      message:
        '每个月计划都为让您变得更好的事留了位置，每个月它都没被用上。时间是唯一无法做两次预算的东西。',
    },
    {
      title: '更好的自己仍在等待',
      message: '美德已连续 {{months}} 个月低于计划。宁可从小而确定的开始，也不要宏大而遥远。',
    },
    {
      title: '好的意图正在变老',
      message:
        '{{months}} 个月来，健康、学习和慷慨得到的都少于计划。下个月挑一项，先于其他一切为它拨款。',
    },
    {
      title: '美德总是输给“以后”',
      message: '连续 {{months}} 个月低于计划。“以后”是好意图被遗忘的地方——给它定个日子。',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: '您的计划里没有美德的位置',
      message:
        '您的预算中没有一项服务于健康、学习或他人。计划体现我们看重什么——考虑给美德单独设一项。',
    },
    {
      title: '样样有预算，唯独善事没有',
      message: '必需、工作和休闲都有限度，美德却没有。从不计划的事，往往永远不会发生。',
    },
    {
      title: '为让您变得更好的事做计划',
      message: '美德类别下还没有预算。哪怕很小——书、运动、一笔捐赠——也能把愿望变成承诺。',
    },
    {
      title: '计划对美德只字未提',
      message:
        '您为必须的和喜欢的做预算，却还没为想成为的人做预算。一个适度的美德预算就能改变这一点。',
    },
    {
      title: '美德没有预算',
      message: '健康、学习或他人方面的支出在任何地方都没有计划。挑一项，给它一个您乐于达到的限度。',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: '必需开支超出计划',
      message:
        '您计划必需占支出的 {{planned}}%，实际占了 {{actual}}%。检查每一项是否仍是需要，还是已悄悄变成了享受。',
    },
    {
      title: '必需 {{actual}}%，计划 {{planned}}%',
      message: '生活真正需要的，通常少于我们习惯的。用新的眼光审视最大的那项必需开支。',
    },
    {
      title: '基本开支在膨胀',
      message:
        '必需占本月的 {{actual}}%，而您预期的是 {{planned}}%。一个不断增长的需要，值得问一问。',
    },
    {
      title: '需要正在撑破计划',
      message:
        '计划 {{planned}}%，实际 {{actual}}%。要么计划低估了真实成本，要么有些欲望借着需要的名义混了进来。',
    },
    {
      title: '花在“必须”上的比本意多',
      message:
        '必需占了支出的 {{actual}}%，而不是 {{planned}}%。把真正必须的和只是向来如此的分开。',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: '必需开支在悄悄上涨',
      message:
        '必需开支已连续 {{months}} 个月上升，累计上涨 {{percent}}%。没人要求需要证明自己时，它们就会悄悄长大。',
    },
    {
      title: '{{months}} 个月内必需开支 +{{percent}}%',
      message:
        '每一步看起来都很小，合起来却不小。拿出最大的一项固定必需开支，问问它是否仍必须花这么多。',
    },
    {
      title: '您支出的底线在抬高',
      message:
        '必需开支连续 {{months}} 个月增长（+{{percent}}%）。底线越高，留给您自由选择的空间就越少。',
    },
    {
      title: '需要在扩张',
      message:
        '增长了 {{months}} 个月，累计 {{percent}}%。斯多葛式的检验很简单：知道了价格，今天您还会再选它吗？',
    },
    {
      title: '小幅上涨，方向稳定',
      message:
        '必需开支 {{months}} 个月上涨了 {{percent}}%。方向比任何单月都重要——这个方向值得及早纠正。',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: '工作开支超出计划',
      message:
        '您计划工作占支出的 {{planned}}%，实际占了 {{actual}}%。工具和服务应当物有所值——看看哪些做到了。',
    },
    {
      title: '工作开支 {{actual}}%，计划 {{planned}}%',
      message: '对工作的投入，有回报才是好投入。检查一下那些付了钱却不再使用的东西。',
    },
    {
      title: '工作预算吃紧',
      message:
        '工作占了 {{actual}}%，而不是 {{planned}}%。勤勉是把工作做好，而不是为它买下每一件工具。',
    },
    {
      title: '工具花费超出计划',
      message:
        '工作方面计划 {{planned}}%，实际 {{actual}}%。对每笔开支问一句：它是在帮我做事，还是只是让我感觉在进步？',
    },
    {
      title: '工作开支在漂移',
      message:
        '工作占支出的 {{actual}}%，本意是 {{planned}}%。现在做个快速检查，能省下以后更大的清理。',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}”再次超出限度',
      message:
        '在最近 {{window}} 个月中，“{{category}}”有 {{months}} 个月超出预算。要么限度不对，要么欲望不对——请决定是哪一个。',
    },
    {
      title: '“{{category}}”：{{window}} 个月中 {{months}} 个月超预算',
      message: '总被越过的限度不是限度，只是愿望。让它诚实起来——有意提高它，或有意守住它。',
    },
    {
      title: '同一项预算又失守了',
      message:
        '“{{category}}”在 {{window}} 个月里 {{months}} 次超出限度。重复本身就是信息，好好利用它。',
    },
    {
      title: '“{{category}}”需要您的关注',
      message:
        '{{window}} 个月中有 {{months}} 个月超预算。留意购买前的那一刻——那是唯一能改变习惯的地方。',
    },
    {
      title: '“{{category}}”中的一种模式',
      message:
        '{{window}} 个月里超支 {{months}} 次。我们反复做什么，就成为什么；想想您希望这个类别如何说明您。',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}”将在{{day}}日用完',
      message:
        '{{limitAmount}} 中已花 {{spentAmount}}，照此速度，限额将在{{day}}日左右用完。现在放慢，比以后停下容易。',
    },
    {
      title: '“{{category}}”跑在了月份前面',
      message:
        '{{limitAmount}} 的限额已用去 {{spentAmount}}。照这个速度，{{day}}日就会用尽——这个月剩下的日子仍由您来安排。',
    },
    {
      title: '速度检查：“{{category}}”',
      message: '按当前速度，{{limitAmount}} 的预算大约能撑到{{day}}日。远见是最便宜的自律。',
    },
    {
      title: '“{{category}}”在透支未来',
      message:
        '{{limitAmount}} 中已花 {{spentAmount}}；限额将在{{day}}日前后用完。这周怎么做，决定这是否会发生。',
    },
    {
      title: '“{{category}}”的提前预警',
      message:
        '按当前速度，{{limitAmount}} 的限额撑不到月底——大约{{day}}日就会用完。趁代价还小时调整。',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}”一直没有使用',
      message:
        '“{{category}}”的预算已有 {{months}} 个月没有任何支出。要么您已不再需要它，要么它是一个仍在等待的意图——决定是哪一种。',
    },
    {
      title: '一项空着的预算：“{{category}}”',
      message:
        '{{months}} 个月没有一笔开支。计划应当描述您正在过的生活，或您正在建设的生活——这是哪一种？',
    },
    {
      title: '“{{category}}”闲置着',
      message: '这里已 {{months}} 个月没有花费。如果是克制，做得好；如果是疏忽，就行动起来。',
    },
    {
      title: '有计划，却没有过上',
      message:
        '“{{category}}”设了限额，却已 {{months}} 个月没有支出。让计划保持真实：要么删掉，要么用起来。',
    },
    {
      title: '“{{category}}”：安静的 {{months}} 个月',
      message: '从未动用的预算仍占着计划里的位置。要么腾出这个位置，要么兑现这个意图。',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% 的支出没有限度',
      message:
        '当月有 {{unbudgetedAmount}} 花在了没有预算关注的类别上。没有看过的东西，就无从判断。',
    },
    {
      title: '这个月大部分没有计划',
      message:
        '{{percent}}% 的支出（{{unbudgetedAmount}}）不在任何预算之内。给其中最大的一项设个限度，计划就能看到更多您的生活。',
    },
    {
      title: '计划之外的支出',
      message:
        '预算只覆盖了您支出的一部分；{{unbudgetedAmount}}（{{percent}}%）无人衡量。把计划延伸到钱真正流去的地方。',
    },
    {
      title: '计划只看到了局部',
      message: '当月支出的 {{percent}}% 没有预算。先看清，才谈得上判断得好。',
    },
    {
      title: '{{unbudgetedAmount}} 花在了限度之外',
      message: '这占本月的 {{percent}}%。您不必限制它——只需决定其中多少是您真正想要的。',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}”占了您休闲的大头',
      message: '休闲支出的 {{percent}}% 去了“{{category}}”。尽管享受，但要确认自己随时能够离开它。',
    },
    {
      title: '一种快乐占了上风',
      message:
        '“{{category}}”占您全部休闲支出的 {{percent}}%。问问它是否仍让您愉悦，还是已成了例行公事。',
    },
    {
      title: '休闲倚靠着“{{category}}”',
      message: '{{percent}}% 的休闲集中在一处。离不开的东西会牵制我们——看看它的牵制是否仍然轻微。',
    },
    {
      title: '“{{category}}”：休闲的 {{percent}}%',
      message: '几乎全部休闲都被同一个乐趣占去了。暂时不碰它，看看它究竟给了您什么。',
    },
    {
      title: '您的休息只有一个去处',
      message:
        '休闲的钱大部分，也就是 {{percent}}%，花在了“{{category}}”上。只有离得开一种乐趣，您才真正不受它的支配。',
    },
  ],
  'stoic.unclassified': [
    {
      title: '部分支出尚未评判',
      message: '未归类的类别：{{count}} 个。请在“预算”中决定哪些是必需、工作、美德或休闲。',
    },
    {
      title: '{{count}} 个类别等待您的判断',
      message: '它们有支出却未归入任何一类，建议因此无法衡量它们。在“预算”里花一分钟就能解决。',
    },
    {
      title: '说出您的钱在为什么服务',
      message: '仍有 {{count}} 个类别未归类。判断始于正确地称呼事物。',
    },
    {
      title: '未经判断的支出：{{count}} 个类别',
      message: '它是需要、您的工作、美德还是享乐？只有您能回答——一旦回答，计划就更清晰。',
    },
    {
      title: '有几个类别没有归类',
      message:
        '{{count}} 个类别不在四类之中。请在“预算”中为它们归类，让每一笔开支都被看清本来面目。',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '在 {{merchant}} 的 {{count}} 笔小额消费',
      message:
        '每一笔看上去都微不足道；合在一起，整个月合计 {{totalAmount}}。没有经过审视的小习惯，是钱悄悄流走最多的地方。',
    },
    {
      title: '{{merchant}}：一个月 {{count}} 次',
      message:
        '零碎的小额合计 {{totalAmount}}。问问自己，每一次去是出于选择还是出于反射：只有前者才是自由。',
    },
    {
      title: '积少成多：{{totalAmount}}',
      message:
        '在 {{merchant}} 消费 {{count}} 次。单独哪一笔都不重要，重要的是习惯。决定您真正想要多频繁。',
    },
    {
      title: '{{merchant}} 的一个习惯',
      message: '{{count}} 笔购买，合计 {{totalAmount}}。试着每三次跳过一次，看看是否会想念它。',
    },
    {
      title: '小事会积累',
      message:
        '您在 {{merchant}} 消费了 {{count}} 次，共 {{totalAmount}}。驾驭大决定的能力，正建立在这样的小决定之上。',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: '周末占了休闲的 {{percent}}%',
      message: '您的休闲支出大多发生在周六和周日。休息是好事；看看那是休息，而不是对一周的补偿。',
    },
    {
      title: '休闲集中在周末',
      message: '{{percent}}% 的休闲支出落在周末。稍微计划一下周末，它会花得更少、给得更多。',
    },
    {
      title: '周末在为整周买单',
      message: '周末占您休闲支出的 {{percent}}%。如果每个周六都要修补这一周，那就看看这一周本身。',
    },
    {
      title: '周六和周日：休闲的 {{percent}}%',
      message: '空闲的日子容易引来随意的花费。周末之前先想好它为何而过，让钱跟着走。',
    },
    {
      title: '周末模式',
      message: '{{percent}}% 的休闲支出发生在周末。工作日过得从容些，周末往往就不那么昂贵。',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} 拿走了本月的 {{percent}}%',
      message:
        '{{totalAmount}} 的休闲支出流向了同一家商户。当一个地方拿走您这么多钱时，问问它还占了您多少注意力。',
    },
    {
      title: '一个地方，{{totalAmount}}',
      message: '{{merchant}} 占当月支出的 {{percent}}%。它值得您用这么大比例的劳动去换吗？',
    },
    {
      title: '{{merchant}} 领跑您的支出',
      message:
        '本月的 {{percent}}%——{{totalAmount}}——花在了那里。享受它没有错，只要您愿意再次选择它。',
    },
    {
      title: '{{merchant}} 占了很大一份',
      message:
        '在同一个休闲场所花了 {{totalAmount}}，即支出的 {{percent}}%。冷静地把快乐与价格放在一起衡量。',
    },
    {
      title: '{{percent}}% 花在 {{merchant}}',
      message: '这一家商户拿走了 {{totalAmount}}。自由，是在您愿意时能从它面前走过。',
    },
  ],
  'stoic.income_drop': [
    {
      title: '收入下降，支出没有',
      message:
        '收入下降 {{percent}}% 至 {{incomeAmount}}，支出却仍是 {{expenseAmount}}。命运改了主意，您的支出还没察觉。',
    },
    {
      title: '收入下降 {{percent}}%',
      message:
        '进账 {{incomeAmount}}，出账 {{expenseAmount}}。命运给的，也可能收回——让支出适应现在，而不是过去。',
    },
    {
      title: '更紧的一个月，同样的习惯',
      message:
        '收入低了 {{percent}}%（{{incomeAmount}}），支出却维持在 {{expenseAmount}}。收入不在您的掌控之中，回应却在。',
    },
    {
      title: '命运转了向',
      message:
        '您比平时少挣了 {{percent}}%，却照旧花了 {{expenseAmount}}。现在就削减，趁它还是选择而不是不得已。',
    },
    {
      title: '支出没有跟上收入的变化',
      message:
        '收入降到 {{incomeAmount}}（下降 {{percent}}%）；支出是 {{expenseAmount}}。按您真正拥有的风来调整帆。',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: '订阅：每月 {{monthlyAmount}}',
      message:
        '{{count}} 项订阅占您每月支出的 {{percent}}%。每一项都不问您就自动续费——那就由您自己逐一问问它们。',
    },
    {
      title: '{{percent}}% 的支出在自动续订',
      message: '{{count}} 项订阅，每月 {{monthlyAmount}}。只保留那些今天您仍会重新订阅的。',
    },
    {
      title: '安静、循环的 {{monthlyAmount}}',
      message: '{{count}} 项订阅花掉您一个月的 {{percent}}%。便利是好仆人，却是昂贵的主人。',
    },
    {
      title: '{{count}} 项订阅待检视',
      message:
        '它们合计每月 {{monthlyAmount}}，占支出的 {{percent}}%。取消一项几乎不用的，看看您有多不想念它。',
    },
    {
      title: '那些自动续订的',
      message: '{{count}} 项订阅每月共 {{monthlyAmount}}。自动的支出，值得一次有意识的检视。',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: '您的成功可以惠及更远一些',
      message:
        '过去 {{months}} 个月，您留住了收入的 {{savingsPercent}}%，却几乎没有分给他人。财富放在张开的手中最为安稳——这个月也许可以送一份礼物或做一次捐赠？',
    },
    {
      title: '收入不少，给予不多',
      message:
        '{{months}} 个月里收入 {{incomeAmount}}，给予他人 {{givenAmount}}。如果您以本应用看不到的方式帮助他人，请忽略这条；如果没有，计划里也留有这份余地。',
    },
    {
      title: '正是慷慨的好时候',
      message:
        '您存下了收入的 {{savingsPercent}}%，说明您手很稳。把其中一小部分给需要的人，这份稳健会更有意义。',
    },
    {
      title: '画面里还没有别人',
      message:
        '最近 {{months}} 个月显示您用心赚钱、认真储蓄，却没有慈善捐赠或礼物。人生来是为了彼此；一份小小的礼物就足以开始。',
    },
    {
      title: '为善意留点空间',
      message:
        '{{incomeAmount}} 中只有 {{givenAmount}} 用于帮助他人。不妨考虑一笔小额的定期捐赠——慷慨和每一种美德一样，成了习惯就更容易。',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}”进度落后',
      message:
        '它每月需要 {{requiredAmount}}，而您目前大约存入 {{paceAmount}}。照这个节奏，会晚 {{monthsLate}} 个月抵达。节奏在您的掌控之中。',
    },
    {
      title: '“{{goal}}”：照此速度晚 {{monthsLate}} 个月',
      message:
        '每月需要 {{requiredAmount}}，实际约 {{paceAmount}}。要么诚实地推迟日期，要么有意识地多投入些钱。',
    },
    {
      title: '目标与步伐意见不合',
      message:
        '“{{goal}}”每月需要 {{requiredAmount}}，实际得到 {{paceAmount}}。目标有多真实，取决于每月迈向它的那一步。',
    },
    {
      title: '“{{goal}}”需要更坚实的一步',
      message:
        '每月 {{paceAmount}}，而它需要 {{requiredAmount}}。下个月先为目标付钱，再考虑任何可有可无的开支。',
    },
    {
      title: '“{{goal}}”落后了',
      message:
        '按目前的节奏（{{paceAmount}}/月），它会晚 {{monthsLate}} 个月。在您掌控之中的是下一步，而不是整条路。',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}”放不进计划',
      message:
        '它每月需要 {{requiredAmount}}，但扣除预算后只有 {{freeAmount}} 可用。改日期、改目标或改预算——指望不是计划。',
    },
    {
      title: '“{{goal}}”要的比您空余的多',
      message:
        '每月需要 {{requiredAmount}}，可用 {{freeAmount}}。什么都想同时要，结果什么都做不成；做出选择。',
    },
    {
      title: '数字说不——暂时如此',
      message:
        '“{{goal}}”每月需要 {{requiredAmount}}；您的空闲资金是 {{freeAmount}}。调整您能掌控的：期限或其他限额。',
    },
    {
      title: '“{{goal}}”需要一个决定',
      message:
        '每月 {{requiredAmount}}，超过了预算之后剩下的 {{freeAmount}}。睁着眼睛选定的目标，胜过靠一厢情愿维持的目标。',
    },
    {
      title: '“{{goal}}”的步伐无法实现',
      message:
        '每月需要 {{requiredAmount}}，空余 {{freeAmount}}。现在诚实地算账，能免去以后的失望。',
    },
  ],
  'stoic.shortfall': [
    {
      title: '{{date}}您的余额将跌破零',
      message:
        '照目前的收入和支出走下去，预计余额会降到 {{lowestAmount}}。趁它还只是预测，现在就做准备。',
    },
    {
      title: '资金缺口将至：{{date}}',
      message:
        '各项付款和日常开销超过了收入，余额最低会到 {{lowestAmount}}。预先想到艰难，它就失去了力量。',
    },
    {
      title: '为{{date}}做好计划',
      message:
        '那一天预计余额将降到 {{lowestAmount}}。推迟一笔付款、搁置一个欲望或预留现金——今天这些都在您的掌控之中。',
    },
    {
      title: '预测将跌破零',
      message: '余额大约在 {{date}} 降到 {{lowestAmount}}。冷静的做法，就是尽早行动。',
    },
    {
      title: '预见{{date}}的缺口',
      message: '预计最低余额：{{lowestAmount}}。预见到的事可以从容应对；让我们措手不及的，很少能。',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: '您守住了对自己的承诺',
      message: '已连续 {{months}} 个月，支出都在您自己设定的计划之内。这就是自制的样子。',
    },
    {
      title: '{{months}} 个月都在计划之内',
      message: '一月又一月，您的打算和您的行动一致。坚持比意志力更安静，也更持久。',
    },
    {
      title: '计划与生活一致',
      message:
        '连续 {{months}} 个月守在限度之内。守得这么好的计划已不再是约束——它就是您的生活方式。',
    },
    {
      title: '稳定了 {{months}} 个月',
      message: '您的预算已连续 {{months}} 个月守住。保持同样的专注，它正在奏效。',
    },
    {
      title: '持续的自律',
      message: '{{months}} 个月没有打破计划。很少有什么比信任自己的决定更让人自由。',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: '您的钱追随您的价值观',
      message: '用于美德的钱占了您支出的 {{actual}}%，不低于您计划的 {{planned}}%。花得好。',
    },
    {
      title: '美德得到了应得的全部',
      message:
        '{{actual}}% 用于健康、学习和他人，计划是 {{planned}}%。您看重什么，就为什么付了钱。',
    },
    {
      title: '花在变得更好上',
      message:
        '健康、学习等方面占了当月支出的 {{actual}}%（计划 {{planned}}%）。美德买不到，但可以去侍奉。',
    },
    {
      title: '意图已付诸实行',
      message:
        '您为美德计划了 {{planned}}%，实际花了 {{actual}}%。好的意图很少能撑过一个月——您的撑过了。',
    },
    {
      title: '钱最好的用处',
      message: '{{actual}}% 用在了让您和他人变得更好的事上。继续这样选择。',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: '休闲各得其所',
      message: '休闲占支出的 {{actual}}%，低于您给它的 {{planned}}%。您享受事物，却不受其支配。',
    },
    {
      title: '快乐，保持分寸',
      message: '休闲占了 {{actual}}%，计划是 {{planned}}%。节制不是错过——而是选择。',
    },
    {
      title: '休息而不过度',
      message: '休闲 {{actual}}%，低于您 {{planned}}% 的限度。享受不当家时，味道更好。',
    },
    {
      title: '安静的节制',
      message: '您给了休闲 {{planned}}%，它只用了 {{actual}}%。这份余地，是您保住的自由。',
    },
    {
      title: '休闲低于计划',
      message: '休闲占支出的 {{actual}}%，守在您设定的 {{planned}}% 之下。守得好。',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '比计划少 {{percent}}%',
      message: '您比允许自己花的少花了 {{savedAmount}}。不必拥有一切本可拥有的，本身就是一种富足。',
    },
    {
      title: '{{savedAmount}} 没有花出去',
      message: '本月比计划低 {{percent}}%。没花掉的钱仍由您来安排去向。',
    },
    {
      title: '少于您允许的',
      message:
        '支出比计划低 {{percent}}%——留住了 {{savedAmount}}。在习惯占领它之前，给这份余地一个用途。',
    },
    {
      title: '计划还有富余',
      message: '低于当月限度 {{savedAmount}}。让人觉得轻松的克制，才是能持久的克制。',
    },
    {
      title: '比计划更轻',
      message: '您比预算少用了 {{percent}}%。考虑把这 {{savedAmount}} 投向一个目标。',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}”按计划推进',
      message: '您已完成 {{percent}}%，步伐正是目标所需。每月稳步前行，能走得很远。',
    },
    {
      title: '“{{goal}}”在正轨上',
      message: '已完成 {{percent}}%，步伐稳定。继续先为目标付钱，这正在奏效。',
    },
    {
      title: '“{{goal}}”：{{percent}}%，稳步前进',
      message: '目标每个月都得到了它需要的。耐心正在发挥作用。',
    },
    {
      title: '目标如期推进',
      message:
        '“{{goal}}”已筹得 {{percent}}%，进度准时。每月做一点的事，不会被一个糟糕的星期打断。',
    },
    {
      title: '值得信赖的进展',
      message: '“{{goal}}”已达 {{percent}}%，步伐如期。您正用唯一行得通的方式建设它——循序渐进。',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: '在 {{merchant}} 的冲动消费变少了',
      message: '从一个月 {{before}} 笔购买，降到约 {{after}} 笔。习惯松动一分，自由便多一分。',
    },
    {
      title: '{{merchant}}：{{before}} → {{after}}',
      message: '您去得比以前少了。每一次忍住的反射，都是选择对习惯的小小胜利。',
    },
    {
      title: '小习惯在缩小',
      message:
        '在 {{merchant}} 的消费从 {{before}} 次降到约 {{after}} 次。继续下去——会越来越容易。',
    },
    {
      title: '选择胜过反射',
      message:
        '在 {{merchant}}，您从 {{before}} 次消费减到约 {{after}} 次。这就是一次次决定积累起来的自主。',
    },
    {
      title: '小开销少了',
      message: '您在 {{merchant}} 消费了约 {{after}} 次，而不是 {{before}} 次。小胜利会不断累积。',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: '您适应了更紧的一个月',
      message:
        '收入下降 {{incomePercent}}%，您把支出削减了 {{expensePercent}}%。命运变了，您也调整了航向。',
    },
    {
      title: '收入下滑时保持镇定',
      message:
        '收入降 {{incomePercent}}%，支出降 {{expensePercent}}%。您适应的是现在，而不是过去。',
    },
    {
      title: '命运变了，您也变了',
      message:
        '收入下降 {{incomePercent}}%，支出随之下降 {{expensePercent}}%。这就是用数字写成的泰然。',
    },
    {
      title: '掌舵得当',
      message:
        '收入下降 {{incomePercent}}% 时，支出也跟着减少了 {{expensePercent}}%。风不由您，帆由您。',
    },
    {
      title: '支出随收入一起下调',
      message:
        '收入下降 {{incomePercent}}%，您少花了 {{expensePercent}}%。及早适应，是平静度过的方式。',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: '必需开支保持稳定',
      message: '{{months}} 个月来，您的基本开支几乎没有变化。稳定的底线，让您在其上拥有自由。',
    },
    {
      title: '需要得到了控制',
      message: '必需开支已持平 {{months}} 个月。不再增长的需要，就是您掌控的需要。',
    },
    {
      title: '{{months}} 个月基本开支稳定',
      message: '房租、饮食和账单都保持原样。安静的稳定，也是一种成就。',
    },
    {
      title: '必需开支没有悄悄上涨',
      message: '{{months}} 个月来，生活所需没有漂移。在这样的基础上，其他一切都更容易计划。',
    },
    {
      title: '坚实的底线',
      message: '基本开支已稳定 {{months}} 个月。您没有让享受冒充需要。',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: '对所得慷慨',
      message:
        '过去 {{months}} 个月，您收入的 {{percent}}%，即 {{givenAmount}}，用于帮助他人。这是钱最好的用处。',
    },
    {
      title: '已给予他人 {{givenAmount}}',
      message:
        '{{months}} 个月里，您分享了收入的 {{percent}}%。体现在数字里的善意，是践行的善意，而不只是心里的善意。',
    },
    {
      title: '张开的手',
      message:
        '近来慈善和礼物占了您收入的 {{percent}}%。您给出去的，是财富中任何不幸都夺不走的那一部分。',
    },
    {
      title: '慷慨是您计划的一部分',
      message:
        '{{months}} 个月里给予他人 {{givenAmount}}。请保持下去——您为他人做的好事，也是为自己做的好事。',
    },
    {
      title: '给得其所',
      message: '您所赚的 {{percent}}% 用于帮助他人。很少有习惯比这更能说明一个人。',
    },
  ],
  'stoic.praise_steady': [
    {
      title: '无需纠正',
      message: '您的支出与您的打算一致。继续保持。',
    },
    {
      title: '意图与行动一致',
      message: '这段时间正如您所计划的那样。这份一致，正是全部要点。',
    },
    {
      title: '平静的一个月',
      message: '没有值得一提的过度，也没有疏忽。做得好——把同样的专注带到下个月。',
    },
    {
      title: '一切井然',
      message: '计划守住了，没有什么需要纠正。享受您赢得的这份平静。',
    },
    {
      title: '稳健的手',
      message: '这个月按您的计划进行。好习惯让好月份看起来平平无奇。',
    },
  ],
  'stoic.keep_first': [
    {
      title: '先留下属于自己的那一份',
      message:
        '在 {{months}} 个月里，您留下了收入的 {{savingsPercent}}%。塞涅卡提醒过：等到桶底再节省，就太迟了。收入到账的那天，先存下 {{tenthAmount}}。',
    },
    {
      title: '要在桶口节俭',
      message:
        '只有收入的 {{savingsPercent}}% 留在了您手里。等剩下什么再去节俭，总是来得太晚；每月先存 {{tenthAmount}}，现在就可以开始。',
    },
    {
      title: '属于你的，就留住',
      message:
        '塞涅卡劝人守住真正属于自己的东西，并且及早开始。近来留在您手里的只有收入的 {{savingsPercent}}%；发薪日先存 {{tenthAmount}}，让其余的开销去适应剩下的部分。',
    },
    {
      title: '不要等到见底',
      message:
        '{{months}} 个月里您留下了 {{savingsPercent}}%。储蓄只有在还有东西可存的时候才在您的掌控之中：先把 {{tenthAmount}} 放到一边，再做别的事。',
    },
    {
      title: '留下了 {{savingsPercent}}%，而桶正在见底',
      message:
        '每月 {{tenthAmount}}，即收入的十分之一，在付任何账单之前先存起来。您先留下的部分，不取决于月底剩下什么。',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: '趁平静时做准备',
      message:
        '您的储备大约够支撑 {{cushionDays}} 天的开销。塞涅卡说：灵魂应当在无忧无虑的时候磨砺自己。三个月的开销是 {{targetAmount}}。',
    },
    {
      title: '{{cushionDays}} 天的储备',
      message:
        '命运不会预先通知。趁眼下没有急事，朝着 {{targetAmount}}，也就是三个月的开销努力：这时候最容易。',
    },
    {
      title: '“这就是我所害怕的处境吗？”',
      message:
        '塞涅卡让卢基里乌斯演练贫穷，好让它失去可怕之处。手里只有 {{cushionDays}} 天的储备，一个艰难的月份就不再是演练。把目标定在 {{targetAmount}}。',
    },
    {
      title: '预见艰难的月份',
      message:
        '您的储蓄大约能撑 {{cushionDays}} 天。预见到的事来得温和；{{targetAmount}} 可以支撑您三个月。',
    },
    {
      title: '在风暴来临之前筑好墙',
      message:
        '目前约有 {{cushionDays}} 天的保障。失去收入不在您的掌控之中，储备却在。三个月的开销合计 {{targetAmount}}。',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: '欲望跑在了收入前面',
      message:
        '上一季度支出增长了 {{expenseGrowth}}%，收入的变化是 {{incomeGrowth}}%。塞涅卡写道：贫穷的不是拥有太少的人，而是渴求更多的人。',
    },
    {
      title: '活得更高，而不是更好',
      message:
        '支出增长了 {{expenseGrowth}}%，收入增长了 {{incomeGrowth}}%。自然的需求微乎其微，虚荣的索求却永无止境。问问自己，这笔增长满足的是哪一种。',
    },
    {
      title: '欲望在增长：+{{expenseGrowth}}%',
      message:
        '支出的增长快过了收入（{{incomeGrowth}}%）。一份新的舒适很快就会被当作必需：趁还拒绝得了，先留意到它。',
    },
    {
      title: '“够了”的标准在移动',
      message:
        '支出环比增长 {{expenseGrowth}}%，收入是 {{incomeGrowth}}%。只有由您自己来定，“够了”才始终是够了。',
    },
    {
      title: '更多并不是解药',
      message:
        '上一季度支出增长 {{expenseGrowth}}%，收入增长 {{incomeGrowth}}%。随欲望一同增长的财富永远不会抵达；趁它还没成为新的常态，先定好限度。',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} 花掉了您 {{hours}} 小时的生命',
      message:
        '塞涅卡提醒我们，只有时间真正属于我们。在 {{merchant}} 花的 {{totalAmount}}，约等于您 {{hours}} 小时的工作。值得吗？',
    },
    {
      title: '在 {{merchant}} 的 {{hours}} 小时',
      message:
        '我们看守着金钱，却把时间白白送人。按您的平均时薪，在那里花的 {{totalAmount}} 大约是 {{hours}} 个工作小时。',
    },
    {
      title: '用小时来标价',
      message:
        '在 {{merchant}} 花的 {{totalAmount}} 约等于 {{hours}} 小时的工作。小时是唯一无法挣回来的东西。',
    },
    {
      title: '{{merchant}} 真正的代价',
      message:
        '您用日子换金钱，再用金钱换东西。{{merchant}} 拿走了您大约 {{hours}} 小时（{{totalAmount}}）。这份愉悦配得上这些小时吗？',
    },
    {
      title: '称一称这些小时',
      message:
        '按您的平均时薪折算，在 {{merchant}} 花的 {{totalAmount}} 约为 {{hours}} 小时。塞涅卡写道，我们损失了大量的时间。这是您自己的选择吗？',
    },
  ],
  'stoic.rule_broken': [
    {
      title: '规则“{{rule}}”迷失了方向',
      message:
        '它指向的东西已经不存在，于是悄悄失效了。修好它，或者删掉它：什么都不做的秩序，只是看起来像秩序。',
    },
    {
      title: '“{{rule}}”不再起作用',
      message:
        '它用到的类别、账户或收款方已经没有了，现在每一笔交易都会略过这条规则。看清事情的原貌，然后去修正。',
    },
    {
      title: '一条指向虚无的规则',
      message:
        '“{{rule}}”把交易送往一个已被移除的地方。您曾经做过一个决定；情况变了，现在再决定一次。',
    },
    {
      title: '“{{rule}}”需要您的判断',
      message:
        '它所指的对象已被删除，它原先归类的交易如今都在等您处理。给它一个新的目标，或者放手。',
    },
    {
      title: '一条坏掉的规则，悄无声息',
      message: '“{{rule}}”什么也没做，也没有提醒您。修复在您能力之内的事吧：只需一分钟。',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: '您的手与“{{rule}}”意见不合',
      message:
        '有 {{count}} 次，您手动归入了这条规则会归到别处的类别。要么规则错了，要么手错了：决定是哪一个。',
    },
    {
      title: '“{{rule}}”被推翻了 {{count}} 次',
      message:
        '一条您不断去纠正的规则，已经不再是一个决定，只是自己和自己争论的习惯。改掉它，或者信任它。',
    },
    {
      title: '说到的，就做到',
      message:
        '规则“{{rule}}”说的是一回事，您最近 {{count}} 次的纠正说的是另一回事。让两者保持一致。',
    },
    {
      title: '一个有争议的决定',
      message:
        '您在头脑清醒时设定了“{{rule}}”，此后有 {{count}} 笔交易走向了别处。请冷静地再看一遍，当初和现在，哪一个才对。',
    },
    {
      title: '{{count}} 次纠正，针对“{{rule}}”',
      message: '重复本身就是信息。让它改变规则，或者让规则改变习惯。',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: '对 {{payee}}，只决定一次',
      message:
        '您已经手动归类 {{payee}} 达 {{decided}} 次，每次都一样。凡是一再重复决定的事，就在头脑清醒时决定一次。',
    },
    {
      title: '同一个决定做了 {{decided}} 次',
      message:
        '{{payee}} 总是问同一个问题，您也总是给同一个答案。有了规则，您的注意力就可以留给真正需要它的事。',
    },
    {
      title: '可以建立规则的收款方：{{count}} 个',
      message:
        '有些收款方总是被您归入同一个类别，其中以 {{payee}} 最多。把您的判断留给新的事物吧。',
    },
    {
      title: '您的习惯已可成为原则',
      message:
        '您每次都用同样的方式归类 {{payee}}（目前已有 {{decided}} 次）。把它写成规则，它就能不费力地一直成立。',
    },
    {
      title: '让规则来承担这件事',
      message:
        '每次都以同样方式归类的收款方有 {{count}} 个，{{payee}} 涉及 {{decided}} 笔交易。一条原则一旦定下，就不必再争论。',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}”已经 {{months}} 个月没有遇到任何交易',
      message:
        '要么它当初所针对的情形已经消失，要么它的条件没有对准目标。让您的规则保持真实：修好它，或者删掉它。',
    },
    {
      title: '一条休眠的规则：“{{rule}}”',
      message: '它已有 {{months}} 个月没有碰过任何一笔交易。把多余的丢掉，留下来的才更值得信任。',
    },
    {
      title: '“{{rule}}”闲置着',
      message: '{{months}} 个月没有匹配，新的交易却不断到来。先用最近的交易试一试，再做决定。',
    },
    {
      title: '“{{rule}}”还需要吗？',
      message:
        '已有 {{months}} 个月没有任何交易与它匹配。出于习惯而保留的规则，只是多出来的一件要照看的事。',
    },
    {
      title: '一个无事可决的决定',
      message: '“{{rule}}”已经沉默了 {{months}} 个月。秩序，就是拥有所需要的东西，而且只拥有这些。',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: '您的决定站得住',
      message:
        '规则归类了当月 {{percent}}% 的交易，您无需推翻其中任何一条。一个决定，定下一次并且坚持，就能让心灵自由。',
    },
    {
      title: '{{percent}}% 事先已经定好',
      message: '当月大部分交易，都是依照您先前的决定归类的。这就为真正重要的事省下了注意力。',
    },
    {
      title: '原则在起作用',
      message:
        '您的规则处理了 {{percent}}% 的交易，没有引起任何争议。原则一旦确立，日子便安静下来。',
    },
    {
      title: '要决定的更少了',
      message:
        '{{percent}}% 的交易无需再做新的决定。您只判断了一次，而且判断得好，这个判断至今仍然成立。',
    },
    {
      title: '秩序得以保持',
      message:
        '规则归类了当月 {{percent}}% 的交易，没有一条被推翻。好的秩序，看上去就像什么都没有发生。',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}”没有日期',
      message:
        '它停在 {{percent}}%，没有新的存入。当一个人不知道要驶向哪个港口，任何风都不是顺风：定下您打算抵达的那一天。',
    },
    {
      title: '是愿望，还是目标？',
      message: '“{{goal}}”没有期限，也没有节奏。目标是带着日期的决定；给它一个日期，或者放下它。',
    },
    {
      title: '为“{{goal}}”定个日子',
      message: '它走完了 {{percent}}%，却停住不动。随时都能做的事，往往永远不会做。',
    },
    {
      title: '“{{goal}}”在等“有一天”',
      message:
        '最近没有任何存入，也没有哪个日期在催促。“有一天”不在您的日历上；选一个在日历上的日子。',
    },
    {
      title: '“{{goal}}”没有港口',
      message: '完成了 {{percent}}%，却没有期限。知道自己驶向何处，每月的那一步自然随之而来。',
    },
  ],
};
