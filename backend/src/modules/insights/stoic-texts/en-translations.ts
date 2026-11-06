import type { StoicTextMap } from './types';

export const en: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'The month outgrew its plan',
      message:
        'You planned {{plannedAmount}} and have spent {{spentAmount}} — {{percent}}% more. The plan was made with a clear head; let it speak louder than the moment.',
    },
    {
      title: '{{percent}}% past what you meant to spend',
      message:
        'Spending stands at {{spentAmount}} against a plan of {{plannedAmount}}. Look at which limit gave way first — that is where the lesson is.',
    },
    {
      title: 'Your plan and your month disagree',
      message:
        '{{spentAmount}} spent, {{plannedAmount}} intended. Either the plan asked too little of reality or reality asked too much of you — decide which, calmly.',
    },
    {
      title: 'More went out than you allowed',
      message:
        'The month is {{percent}}% over the {{plannedAmount}} you set. Nothing is lost by stopping now; much is lost by pretending it did not happen.',
    },
    {
      title: 'A limit you set, a limit you crossed',
      message:
        'You meant to spend {{plannedAmount}}; it is {{spentAmount}}. Self-command is not never slipping — it is noticing early and returning to the path.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Leisure takes more than you planned',
      message:
        'You meant leisure to be {{planned}}% of your spending; it came to {{actual}}%. Pleasure is welcome as a guest, not as master of the house.',
    },
    {
      title: 'Leisure at {{actual}}%, planned {{planned}}%',
      message:
        'Rest earns its place when it restores you. Ask which of the month’s pleasures did, and let the rest go without regret.',
    },
    {
      title: 'Comfort is outspending intention',
      message:
        'Leisure holds {{actual}}% of spending against the {{planned}}% you chose. Moderation is not refusing pleasure — it is keeping it the size you decided.',
    },
    {
      title: 'The pleasant crowds out the planned',
      message:
        'You gave leisure {{planned}}% of the plan and it took {{actual}}%. What you enjoy easily is worth a second look before it becomes what you need.',
    },
    {
      title: 'Leisure has stepped past its line',
      message:
        '{{actual}}% of the month went to leisure, {{planned}}% was the intention. The line was yours to draw, and it is yours to hold.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Leisure is over plan again',
      message:
        'Leisure went past your plan in {{months}} of the last {{window}} months. A repeat is no longer an accident — it is a habit worth examining.',
    },
    {
      title: '{{months}} of {{window}} months over the leisure plan',
      message:
        'What happens once is circumstance; what happens {{months}} times is character in the making. Choose the character on purpose.',
    },
    {
      title: 'The same slip, month after month',
      message:
        'Leisure overran the plan in {{months}} of {{window}} months. Either lift the plan honestly or change the habit — living between the two costs the most.',
    },
    {
      title: 'A pattern, not a lapse',
      message:
        'In {{months}} of the last {{window}} months leisure took more than you gave it. Notice the moment the decision is made, not only the bill afterwards.',
    },
    {
      title: 'Habit is voting against your plan',
      message:
        'Leisure beat the plan {{months}} times in {{window}} months. Habits are built one choice at a time; so is their undoing.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'Virtue gets less than you intended',
      message:
        'You set aside {{planned}}% of your budget for health, learning and others; it came to {{actual}}%. An intention counts once it is carried out.',
    },
    {
      title: 'Virtue at {{actual}}% of a planned {{planned}}%',
      message:
        'The money you meant for what makes you better is still waiting. There is no better time to spend it well than now.',
    },
    {
      title: 'The good you planned is unspent',
      message:
        'Health, learning and generosity were to get {{planned}}% of spending; they got {{actual}}%. Do one of them this week, deliberately.',
    },
    {
      title: 'Intention without deed',
      message:
        'Virtue holds {{actual}}% of spending against the {{planned}}% you chose. What we value shows in what we actually pay for.',
    },
    {
      title: 'Room left for what matters',
      message:
        'Only {{actual}}% went to virtue, though you planned {{planned}}%. A book, a check-up, a gift to someone in need — the plan already said yes.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'Virtue keeps being postponed',
      message:
        'Spending on health, learning and others has stayed under your plan for {{months}} months in a row. What you keep postponing, you have in fact decided against.',
    },
    {
      title: '{{months}} months of postponed virtue',
      message:
        'Each month the plan made room for what makes you better, and each month it went unused. Time is the one thing you cannot budget twice.',
    },
    {
      title: 'The better self is still waiting',
      message:
        'Virtue has been under plan {{months}} months running. Start small and certain rather than grand and later.',
    },
    {
      title: 'Good intentions are ageing',
      message:
        'For {{months}} months health, learning and generosity got less than you planned. Pick one and fund it first next month, before anything else.',
    },
    {
      title: 'Virtue keeps losing to “later”',
      message:
        '{{months}} months in a row below plan. Later is where good intentions go to be forgotten — give this one a date.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Your plan has no room for virtue',
      message:
        'None of your budgets serves health, learning or others. A plan shows what we value — consider giving virtue a line of its own.',
    },
    {
      title: 'Every budget, but none for the good',
      message:
        'Necessity, work and leisure all have limits; virtue has none. What is never planned for tends never to happen.',
    },
    {
      title: 'Plan for what makes you better',
      message:
        'There is no budget in the virtue class yet. Even a small one — books, sport, a donation — turns a wish into a commitment.',
    },
    {
      title: 'The plan is silent on virtue',
      message:
        'You budget for what you must and what you enjoy, not yet for who you want to become. One modest virtue budget would change that.',
    },
    {
      title: 'Virtue has no budget',
      message:
        'Spending on health, learning or others is not planned anywhere. Choose one and give it a limit you would be glad to reach.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'Necessities cost more than planned',
      message:
        'You planned {{planned}}% of spending for necessities; they take {{actual}}%. Check whether each one is still a need or has quietly become a comfort.',
    },
    {
      title: 'Necessity at {{actual}}%, planned {{planned}}%',
      message:
        'What life requires is usually less than what we grow used to. Review the largest necessity with fresh eyes.',
    },
    {
      title: 'The essentials are swelling',
      message:
        'Necessities hold {{actual}}% of the month against the {{planned}}% you expected. A need that keeps growing deserves a question.',
    },
    {
      title: 'Needs are outgrowing the plan',
      message:
        'Planned {{planned}}%, actual {{actual}}%. Either the plan underestimated real costs, or some wants are travelling under the name of needs.',
    },
    {
      title: 'More spent on “must” than meant',
      message:
        'Necessities took {{actual}}% of spending instead of {{planned}}%. Sort what truly must be from what merely always was.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'Necessities creep upward',
      message:
        'Spending on necessities has risen {{months}} months in a row, {{percent}}% in total. Needs grow quietly when no one asks them to justify themselves.',
    },
    {
      title: '+{{percent}}% on necessities in {{months}} months',
      message:
        'Each step looked small; together they are not. Take the biggest recurring necessity and ask whether it still has to cost this much.',
    },
    {
      title: 'The floor of your spending is rising',
      message:
        'Necessities grew for {{months}} consecutive months (+{{percent}}%). A rising floor leaves less room for everything you choose freely.',
    },
    {
      title: 'Needs are expanding',
      message:
        '{{months}} months of growth, {{percent}}% overall. The Stoic test is simple: would you choose this again today, knowing its price?',
    },
    {
      title: 'Small increases, steady direction',
      message:
        'Necessities are up {{percent}}% over {{months}} months. Direction matters more than any single month — this one is worth correcting early.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Work costs more than planned',
      message:
        'You planned {{planned}}% of spending for work; it takes {{actual}}%. Tools and services should earn their keep — check which ones do.',
    },
    {
      title: 'Work spending at {{actual}}%, planned {{planned}}%',
      message:
        'Investment in your work is good when it returns something. Review what you pay for but no longer use.',
    },
    {
      title: 'The work budget is stretched',
      message:
        'Work took {{actual}}% instead of {{planned}}%. Diligence is doing the work well, not buying every tool for it.',
    },
    {
      title: 'Tools are outspending the plan',
      message:
        'Planned {{planned}}%, spent {{actual}}% on work. Ask of each expense: does it help me do the work, or only feel like progress?',
    },
    {
      title: 'Work costs have drifted',
      message:
        'Work holds {{actual}}% of spending against {{planned}}% intended. A quick audit now saves a larger one later.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '“{{category}}” keeps breaking its limit',
      message:
        '“{{category}}” went over budget in {{months}} of the last {{window}} months. Either the limit is wrong or the desire is — decide which.',
    },
    {
      title: '“{{category}}”: over budget {{months}} of {{window}} months',
      message:
        'A limit that is always crossed is not a limit, only a wish. Make it honest — raise it on purpose or keep it on purpose.',
    },
    {
      title: 'The same budget gives way again',
      message:
        '“{{category}}” has overrun its limit {{months}} times in {{window}} months. The repetition is information; use it.',
    },
    {
      title: '“{{category}}” asks for your attention',
      message:
        'Over budget in {{months}} of {{window}} months. Watch the moment before the purchase — that is the only place the habit can be changed.',
    },
    {
      title: 'A pattern in “{{category}}”',
      message:
        '{{months}} overruns in {{window}} months. What we repeat, we become; decide what you want this category to say about you.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '“{{category}}” runs out by day {{day}}',
      message:
        'You have spent {{spentAmount}} of {{limitAmount}}, and at this pace the limit ends around day {{day}}. Slowing down now is easier than stopping later.',
    },
    {
      title: '“{{category}}” is ahead of the month',
      message:
        '{{spentAmount}} already gone from a {{limitAmount}} limit. At this rate it is exhausted by day {{day}} — the rest of the month is still yours to shape.',
    },
    {
      title: 'Pace check: “{{category}}”',
      message:
        'The budget of {{limitAmount}} will last until about day {{day}} at the current pace. Foresight is the cheapest kind of discipline.',
    },
    {
      title: '“{{category}}” is spending the future',
      message:
        '{{spentAmount}} of {{limitAmount}} spent; the limit ends near day {{day}}. What you do this week decides whether that happens.',
    },
    {
      title: 'Early warning for “{{category}}”',
      message:
        'On the current pace the limit of {{limitAmount}} will not reach the end of the month — it runs out around day {{day}}. Adjust while it costs little.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '“{{category}}” has gone unused',
      message:
        'The budget for “{{category}}” has seen no spending for {{months}} months. Either you have outgrown it, or it is an intention still waiting — decide which.',
    },
    {
      title: 'An empty budget: “{{category}}”',
      message:
        '{{months}} months without a single expense. A plan should describe the life you live or the one you are building — which is this?',
    },
    {
      title: '“{{category}}” stands idle',
      message:
        'Nothing spent here for {{months}} months. If it was restraint, well done; if it was neglect, act on it.',
    },
    {
      title: 'Planned, but not lived',
      message:
        '“{{category}}” has had a limit and no spending for {{months}} months. Keep the plan truthful: remove it or use it.',
    },
    {
      title: '“{{category}}”: {{months}} quiet months',
      message:
        'A budget that is never touched still occupies a place in your plan. Free the place or honour the intention.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% of spending has no limit',
      message:
        '{{unbudgetedAmount}} of the month went to categories no budget watches. What you have not looked at, you cannot judge.',
    },
    {
      title: 'Much of the month is unplanned',
      message:
        '{{percent}}% of spending — {{unbudgetedAmount}} — sits outside every budget. Give the largest of it a limit and the plan will see more of your life.',
    },
    {
      title: 'Spending outside the plan',
      message:
        'Budgets cover only part of what you spend; {{unbudgetedAmount}} ({{percent}}%) goes unmeasured. Extend the plan where the money actually goes.',
    },
    {
      title: 'The plan sees only part of the picture',
      message:
        '{{percent}}% of the month’s spending has no budget. Clear sight comes before good judgment.',
    },
    {
      title: '{{unbudgetedAmount}} spent without a limit',
      message:
        'That is {{percent}}% of the month. You do not have to restrict it — only decide how much of it you actually want.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '“{{category}}” is most of your leisure',
      message:
        '{{percent}}% of leisure spending went to “{{category}}”. Enjoy it, but check that you could walk away from it.',
    },
    {
      title: 'One pleasure dominates',
      message:
        '“{{category}}” takes {{percent}}% of everything you spent on leisure. Ask whether it still delights you or has become routine.',
    },
    {
      title: 'Leisure leans on “{{category}}”',
      message:
        '{{percent}}% of leisure in one place. What we cannot do without has a hold on us — check the grip is still light.',
    },
    {
      title: '“{{category}}”: {{percent}}% of leisure',
      message:
        'A single source of enjoyment is taking almost all of it. Go without it for a while and see what it really gives you.',
    },
    {
      title: 'Your rest has one address',
      message:
        'Most leisure money, {{percent}}%, goes to “{{category}}”. You are free of a pleasure only if you could do without it.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Some spending is not yet judged',
      message:
        '{{count}} categories have no class. Decide in Budgets what is necessity, work, virtue or leisure.',
    },
    {
      title: '{{count}} categories await your judgment',
      message:
        'They have spending but no class, so the advice cannot weigh them. A minute in Budgets settles it.',
    },
    {
      title: 'Name what your money serves',
      message:
        '{{count}} categories are still unclassified. Judgment starts with calling things by their right names.',
    },
    {
      title: 'Unjudged spending: {{count}} categories',
      message:
        'Is it a need, your work, a virtue or a pleasure? Only you can say — and the plan becomes clearer once you do.',
    },
    {
      title: 'A few categories have no class',
      message:
        '{{count}} categories are outside the four classes. Classify them in Budgets so every expense is seen for what it is.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: '{{count}} small purchases at {{merchant}}',
      message:
        'Each looked trivial; together they came to {{totalAmount}} over the month. Small, unexamined habits are where most money quietly goes.',
    },
    {
      title: '{{merchant}}: {{count}} times in a month',
      message:
        '{{totalAmount}} in small amounts. Ask whether each visit was a choice or a reflex: only the first is freedom.',
    },
    {
      title: 'Little by little: {{totalAmount}}',
      message:
        '{{count}} purchases at {{merchant}}. No single one matters; the habit does. Decide how often you actually want it.',
    },
    {
      title: 'A habit at {{merchant}}',
      message:
        '{{count}} purchases, {{totalAmount}} in total. Try skipping one in three and see whether you miss it.',
    },
    {
      title: 'The small things add up',
      message:
        '{{merchant}} saw you {{count}} times, for {{totalAmount}}. Mastery over big decisions is built on small ones like these.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Weekends carry {{percent}}% of leisure',
      message:
        'Most of your leisure spending happens on Saturdays and Sundays. Rest is good; check it is rest and not compensation for the week.',
    },
    {
      title: 'Leisure lives on the weekend',
      message:
        '{{percent}}% of leisure spending falls on weekends. Plan the weekend a little, and it will cost less and give more.',
    },
    {
      title: 'The weekend spends for the week',
      message:
        'Weekends take {{percent}}% of what you spend on leisure. If the week needs repairing every Saturday, look at the week.',
    },
    {
      title: 'Saturday and Sunday: {{percent}}% of leisure',
      message:
        'Free days invite free spending. Decide before the weekend what it is for, and let the money follow.',
    },
    {
      title: 'A weekend pattern',
      message:
        '{{percent}}% of leisure spending happens on weekends. Ease on weekdays often makes weekends less expensive.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} took {{percent}}% of the month',
      message:
        '{{totalAmount}} went to a single merchant for leisure. When one place has that much of your money, ask how much of your attention it has too.',
    },
    {
      title: 'One place, {{totalAmount}}',
      message:
        '{{merchant}} is {{percent}}% of the month’s spending. Is it worth that share of your life’s work?',
    },
    {
      title: '{{merchant}} leads your spending',
      message:
        '{{percent}}% of the month — {{totalAmount}} — went there. Nothing wrong with enjoying it, as long as you would choose it again.',
    },
    {
      title: 'A large share at {{merchant}}',
      message:
        '{{totalAmount}}, or {{percent}}% of spending, in one place of leisure. Weigh the pleasure against the price, calmly.',
    },
    {
      title: '{{percent}}% at {{merchant}}',
      message:
        'This single merchant took {{totalAmount}}. Freedom is being able to walk past it when you choose.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Income fell, spending did not',
      message:
        'Income dropped {{percent}}% to {{incomeAmount}}, but spending stayed at {{expenseAmount}}. Fortune changed its mind; your spending has not noticed yet.',
    },
    {
      title: 'Income down {{percent}}%',
      message:
        '{{incomeAmount}} came in against {{expenseAmount}} going out. What fortune gives it may take back — adjust spending to what is, not what was.',
    },
    {
      title: 'A leaner month, the same habits',
      message:
        'Income is {{percent}}% lower ({{incomeAmount}}), while spending held at {{expenseAmount}}. The income is not in your power; the response is.',
    },
    {
      title: 'Fortune shifted',
      message:
        'You earned {{percent}}% less than usual, but spent {{expenseAmount}} as before. Trim now, while it is a choice rather than a necessity.',
    },
    {
      title: 'Spending has not followed income',
      message:
        'Income fell to {{incomeAmount}} ({{percent}}% down); spending is {{expenseAmount}}. Match the sail to the wind you actually have.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Subscriptions: {{monthlyAmount}} a month',
      message:
        '{{count}} subscriptions take {{percent}}% of your monthly spending. Each one renews without asking you — ask about each one yourself.',
    },
    {
      title: '{{percent}}% of spending renews itself',
      message:
        '{{count}} subscriptions, {{monthlyAmount}} a month. Keep the ones you would sign up for again today.',
    },
    {
      title: 'Quiet, recurring, {{monthlyAmount}}',
      message:
        '{{count}} subscriptions cost {{percent}}% of your month. Convenience is a fine servant and a costly master.',
    },
    {
      title: '{{count}} subscriptions to review',
      message:
        'Together they are {{monthlyAmount}} a month, {{percent}}% of spending. Cancel one you barely use and notice how little you miss it.',
    },
    {
      title: 'What renews by itself',
      message:
        '{{monthlyAmount}} a month across {{count}} subscriptions. Automatic spending deserves a deliberate review.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Your success could reach a little further',
      message:
        'Over {{months}} months you kept {{savingsPercent}}% of your income, yet almost none of it went to others. Wealth sits best in open hands — perhaps one gift or donation this month?',
    },
    {
      title: 'Earning well, giving little',
      message:
        '{{incomeAmount}} came in over {{months}} months and {{givenAmount}} went to others. If you help in ways this app cannot see, ignore this; if not, the plan has room for it.',
    },
    {
      title: 'A good year for being generous',
      message:
        'You saved {{savingsPercent}}% of income — a sign of a steady hand. A small share of that, given to someone who needs it, would make the steadiness mean more.',
    },
    {
      title: 'No one else in the picture yet',
      message:
        'The last {{months}} months show careful earning and saving, but no charity or gifts. We are made for one another; a modest gift is enough to begin.',
    },
    {
      title: 'Room for kindness',
      message:
        'Only {{givenAmount}} of {{incomeAmount}} went to helping others. Consider a small, regular donation — generosity grows easier with habit, like every virtue.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '“{{goal}}” is falling behind',
      message:
        'It needs {{requiredAmount}} a month, and you are putting in about {{paceAmount}}. At this pace it arrives {{monthsLate}} months late. The pace is in your power.',
    },
    {
      title: '“{{goal}}”: {{monthsLate}} months late at this pace',
      message:
        'Required {{requiredAmount}} a month, actual about {{paceAmount}}. Move the date honestly or move more money deliberately.',
    },
    {
      title: 'The goal and the pace disagree',
      message:
        '“{{goal}}” asks {{requiredAmount}} a month; it gets {{paceAmount}}. A goal is only as real as the monthly step toward it.',
    },
    {
      title: '“{{goal}}” needs a firmer step',
      message:
        '{{paceAmount}} a month against the {{requiredAmount}} it needs. Pay the goal first next month, before anything optional.',
    },
    {
      title: 'Behind on “{{goal}}”',
      message:
        'The current pace ({{paceAmount}}/month) leaves it {{monthsLate}} months late. What is in your power is the next step, not the whole road.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '“{{goal}}” does not fit the plan',
      message:
        'It needs {{requiredAmount}} a month, but after your budgets only {{freeAmount}} is free. Change the date, the target or the budgets — hoping is not a plan.',
    },
    {
      title: '“{{goal}}” asks more than you have free',
      message:
        '{{requiredAmount}} required each month, {{freeAmount}} available. Wanting everything at once is how nothing gets done; choose.',
    },
    {
      title: 'The numbers say no — for now',
      message:
        '“{{goal}}” needs {{requiredAmount}} a month; your free cash is {{freeAmount}}. Adjust what is in your power: the deadline or the other limits.',
    },
    {
      title: '“{{goal}}” needs a decision',
      message:
        'At {{requiredAmount}} a month it exceeds the {{freeAmount}} left after budgets. A goal chosen with open eyes is better than one kept by wishful thinking.',
    },
    {
      title: 'An impossible pace for “{{goal}}”',
      message:
        'Required {{requiredAmount}} monthly, free {{freeAmount}}. Honest arithmetic now spares disappointment later.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Your balance dips below zero on {{date}}',
      message:
        'With income and spending as they run now, the projected balance reaches {{lowestAmount}}. Prepare now, while it is only a forecast.',
    },
    {
      title: 'A shortfall is coming: {{date}}',
      message:
        'Payments and everyday spending outrun what comes in, bottoming at {{lowestAmount}}. Anticipating hardship is how it loses its power.',
    },
    {
      title: 'Plan for {{date}}',
      message:
        'On that day the projected balance reaches {{lowestAmount}}. Move a payment, hold back a want, or set cash aside — any of these is in your power today.',
    },
    {
      title: 'The forecast falls below zero',
      message:
        'The balance falls to {{lowestAmount}} around {{date}}. The calm response is the early one.',
    },
    {
      title: 'Foresee the gap on {{date}}',
      message:
        'Projected lowest balance: {{lowestAmount}}. What is foreseen can be met with composure; what surprises us, rarely.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'You kept your word to yourself',
      message:
        'For {{months}} months in a row your spending stayed within the plan you set. This is what self-command looks like.',
    },
    {
      title: '{{months}} months within plan',
      message:
        'Month after month, what you intended and what you did agree. Consistency is quieter than willpower and lasts longer.',
    },
    {
      title: 'Plan and life agree',
      message:
        '{{months}} consecutive months inside your limits. A plan kept this well is no longer a restriction — it is how you live.',
    },
    {
      title: 'Steady for {{months}} months',
      message:
        'Your budgets have held {{months}} months running. Keep the same attention; it is working.',
    },
    {
      title: 'Discipline, sustained',
      message:
        '{{months}} months without breaking your plan. Few things are as freeing as trusting your own decisions.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Your money follows your values',
      message:
        'Money in the service of virtue came to {{actual}}% of your spending, no less than the {{planned}}% you planned. Well spent.',
    },
    {
      title: 'Virtue got its full share',
      message:
        '{{actual}}% on health, learning and others, against {{planned}}% planned. What you value, you paid for.',
    },
    {
      title: 'Spent on becoming better',
      message:
        'Health, learning and others got {{actual}}% of the month’s spending (planned {{planned}}%). Virtue cannot be bought, but it can be served.',
    },
    {
      title: 'Intention carried out',
      message:
        'You planned {{planned}}% for virtue and spent {{actual}}%. Good intentions rarely survive a month — yours did.',
    },
    {
      title: 'The best use of money',
      message: '{{actual}}% went to what makes you and others better. Keep choosing it.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Leisure in its place',
      message:
        'Leisure is {{actual}}% of spending, below the {{planned}}% you allowed it. You enjoy things without being ruled by them.',
    },
    {
      title: 'Pleasure, kept to size',
      message:
        'Leisure took {{actual}}% against {{planned}}% planned. Moderation is not missing out — it is choosing.',
    },
    {
      title: 'Rest without excess',
      message:
        '{{actual}}% on leisure, under your {{planned}}% limit. Enjoyment tastes better when it is not in charge.',
    },
    {
      title: 'Temperance, quietly',
      message:
        'You gave leisure {{planned}}% and it used only {{actual}}%. That margin is freedom you kept.',
    },
    {
      title: 'Leisure below plan',
      message:
        'At {{actual}}% of spending, leisure stayed under the {{planned}}% you set. Well held.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% under plan',
      message:
        'You spent {{savedAmount}} less than you allowed yourself for the month. Not needing everything you could have is a kind of wealth.',
    },
    {
      title: '{{savedAmount}} left unspent',
      message:
        'The month came in {{percent}}% below plan. What you did not spend is still yours to direct.',
    },
    {
      title: 'Less than you allowed',
      message:
        'Spending is {{percent}}% under the plan — {{savedAmount}} kept. Give that margin a purpose before habit claims it.',
    },
    {
      title: 'The plan had room to spare',
      message:
        '{{savedAmount}} under your limits for the month. Restraint that feels easy is the kind that lasts.',
    },
    {
      title: 'Lighter than planned',
      message:
        'You needed {{percent}}% less than you budgeted. Consider sending the {{savedAmount}} toward a goal.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '“{{goal}}” is on schedule',
      message:
        'You are {{percent}}% of the way there, at the pace the goal needs. Steady steps, taken monthly, reach far.',
    },
    {
      title: 'On track for “{{goal}}”',
      message: '{{percent}}% done and the pace holds. Keep paying the goal first; it is working.',
    },
    {
      title: '“{{goal}}”: {{percent}}% and steady',
      message: 'The goal is getting what it needs every month. Patience is doing its work.',
    },
    {
      title: 'The goal moves as planned',
      message:
        '“{{goal}}” is {{percent}}% funded and on time. What is done a little every month cannot be stopped by one bad week.',
    },
    {
      title: 'Progress you can trust',
      message:
        '“{{goal}}” stands at {{percent}}%, on pace. You are building it the only way that works — gradually.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Fewer impulse buys at {{merchant}}',
      message:
        'From {{before}} purchases in a month to about {{after}}. A habit loosened is freedom gained.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'You visit less than you used to. Every skipped reflex is a small victory of choice over habit.',
    },
    {
      title: 'The small habit is shrinking',
      message:
        'Purchases at {{merchant}} fell from {{before}} to about {{after}}. Keep going — it gets easier.',
    },
    {
      title: 'Choice over reflex',
      message:
        'At {{merchant}} you went from {{before}} purchases to about {{after}}. That is mastery built one decision at a time.',
    },
    {
      title: 'Less of the small stuff',
      message:
        '{{merchant}} saw you about {{after}} times instead of {{before}}. Small wins compound.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'You adapted to a leaner month',
      message:
        'Income fell {{incomePercent}}%, and you cut spending {{expensePercent}}%. You met a change of fortune with a change of course.',
    },
    {
      title: 'Composure when income dipped',
      message:
        'Income down {{incomePercent}}%, spending down {{expensePercent}}%. You adjusted to what is, not to what was.',
    },
    {
      title: 'Fortune changed; so did you',
      message:
        'A {{incomePercent}}% drop in income met a {{expensePercent}}% drop in spending. That is equanimity in numbers.',
    },
    {
      title: 'Well steered',
      message:
        'When income fell {{incomePercent}}%, spending followed ({{expensePercent}}% less). The wind was not yours; the sail was.',
    },
    {
      title: 'Spending followed income down',
      message:
        'You spent {{expensePercent}}% less as income fell {{incomePercent}}%. Adapting early is the calm way through.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'Necessities are steady',
      message:
        'For {{months}} months your essential costs have barely moved. A stable floor gives you freedom above it.',
    },
    {
      title: 'Needs kept in check',
      message:
        'Necessity spending held level for {{months}} months. Needs that do not grow are needs you control.',
    },
    {
      title: '{{months}} months of stable essentials',
      message:
        'Rent, food and bills stayed where they were. Quiet stability is an achievement too.',
    },
    {
      title: 'No creep in necessities',
      message:
        '{{months}} months without drift in what life requires. Everything else is easier to plan on that ground.',
    },
    {
      title: 'A firm floor',
      message:
        'Essential spending has been steady for {{months}} months. You are not letting comforts pass as needs.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generous with what you earn',
      message:
        'Over {{months}} months {{percent}}% of your income — {{givenAmount}} — went to helping others. That is money put to its best use.',
    },
    {
      title: '{{givenAmount}} given to others',
      message:
        'You shared {{percent}}% of your income in {{months}} months. Kindness that shows up in the numbers is kindness practised, not only felt.',
    },
    {
      title: 'Open hands',
      message:
        'Charity and gifts took {{percent}}% of your income lately. What you give away is the part of your wealth no misfortune can take.',
    },
    {
      title: 'Generosity is part of your plan',
      message:
        '{{givenAmount}} to others over {{months}} months. Keep it — the good you do for others is good done for yourself as well.',
    },
    {
      title: 'Well given',
      message:
        '{{percent}}% of what you earned went to helping others. Few habits say more about a person.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nothing to correct',
      message: 'Your spending matches what you intended. Keep going as you are.',
    },
    {
      title: 'Intention and action agree',
      message: 'The month looks the way you planned it. That agreement is the whole point.',
    },
    {
      title: 'A calm month',
      message:
        'No excess, no neglect worth mentioning. Well done — carry the same attention forward.',
    },
    {
      title: 'All in order',
      message: 'Your plan held and nothing asks for correction. Enjoy the quiet you earned.',
    },
    {
      title: 'Steady hand',
      message: 'The month followed your plan. Good habits make good months look ordinary.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Keep your part first',
      message:
        'Over {{months}} months you kept {{savingsPercent}}% of income. Seneca’s warning: it is too late to spare at the bottom of the cask. Set aside {{tenthAmount}} the day income arrives.',
    },
    {
      title: 'Spare at the top of the cask',
      message:
        'Only {{savingsPercent}}% of income stayed with you. Thrift that waits for what is left over comes too late; {{tenthAmount}} a month, set aside first, begins it now.',
    },
    {
      title: 'What is yours, keep',
      message:
        'Seneca advises keeping what is really yours and beginning early. Lately {{savingsPercent}}% of income has stayed with you; start with {{tenthAmount}} on payday and let spending fit around the rest.',
    },
    {
      title: 'Begin before the dregs',
      message:
        'You kept {{savingsPercent}}% over {{months}} months. Saving is in your power only while there is still something to save: move {{tenthAmount}} aside before anything else.',
    },
    {
      title: '{{savingsPercent}}% kept, and the cask is draining',
      message:
        '{{tenthAmount}} a month, a tenth of income, put aside before any bill. What you keep first does not depend on what the month leaves over.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Prepare while it is calm',
      message:
        'Your reserve covers about {{cushionDays}} days of spending. Seneca: the soul should toughen itself in times free of care. Three months of spending is {{targetAmount}}.',
    },
    {
      title: 'A reserve of {{cushionDays}} days',
      message:
        'Fortune does not announce itself. Build toward {{targetAmount}}, three months of spending, while nothing is pressing: that is when it is easy.',
    },
    {
      title: '“Is this the condition that I feared?”',
      message:
        'Seneca had Lucilius rehearse poverty so that it would lose its terror. With {{cushionDays}} days in reserve, one hard month would be no rehearsal. Aim for {{targetAmount}}.',
    },
    {
      title: 'Foresee the hard month',
      message:
        'Your savings would last roughly {{cushionDays}} days. What is foreseen comes gently; {{targetAmount}} would carry you for three months.',
    },
    {
      title: 'Build the wall before the storm',
      message:
        'About {{cushionDays}} days are covered. Losing income is not in your power; the reserve is. Three months of spending comes to {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Wants are outrunning income',
      message:
        'Spending rose {{expenseGrowth}}% over the last quarter while income changed {{incomeGrowth}}%. It is not the one who has too little, Seneca writes, but the one who craves more, that is poor.',
    },
    {
      title: 'Living higher, not better',
      message:
        'Spending grew {{expenseGrowth}}%, income {{incomeGrowth}}%. Nature’s wants are slight; the demands of opinion are boundless. Ask which of them the increase serves.',
    },
    {
      title: 'The wants have grown: +{{expenseGrowth}}%',
      message:
        'Expenses climbed faster than income ({{incomeGrowth}}%). A new comfort soon feels like a need: notice it while you can still refuse it.',
    },
    {
      title: 'The goalposts are moving',
      message:
        'Spending is up {{expenseGrowth}}% quarter on quarter against {{incomeGrowth}}% for income. Enough stays enough only if you decide what it is.',
    },
    {
      title: 'More is not the cure',
      message:
        'Over the last quarter spending grew {{expenseGrowth}}% and income {{incomeGrowth}}%. Wealth that grows with desire never arrives; set the limit before this becomes the new normal.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} cost {{hours}} hours of your life',
      message:
        'Seneca reminds us that only time is truly ours. {{totalAmount}} at {{merchant}} is about {{hours}} hours of your work. Was it worth that?',
    },
    {
      title: '{{hours}} hours at {{merchant}}',
      message:
        'We guard our money and give our time away. At your average hourly income, {{totalAmount}} there is roughly {{hours}} working hours.',
    },
    {
      title: 'Price it in hours',
      message:
        '{{totalAmount}} at {{merchant}} is about {{hours}} hours of work. Hours are the one thing you cannot earn back.',
    },
    {
      title: 'What {{merchant}} really cost',
      message:
        'You trade your days for money, and money for things. {{merchant}} took about {{hours}} hours of yours ({{totalAmount}}). Does the pleasure match the hours?',
    },
    {
      title: 'Weigh the hours',
      message:
        'Converted at your average hourly income, {{totalAmount}} at {{merchant}} is about {{hours}} hours. We lose a great deal of our time, Seneca writes. Did you choose this?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'The rule “{{rule}}” has lost its way',
      message:
        'It points at something that no longer exists, so it has quietly stopped working. Mend it or remove it: order that does nothing only looks like order.',
    },
    {
      title: '“{{rule}}” no longer acts',
      message:
        'Its category, account or payee is gone, and the rule is now passed over on every transaction. See things as they are, then fix them.',
    },
    {
      title: 'A rule aimed at nothing',
      message:
        '“{{rule}}” sends transactions to a place that has been removed. You decided something once; decide again, now that things have changed.',
    },
    {
      title: '“{{rule}}” needs your judgment',
      message:
        'What it refers to has been deleted, and the transactions it used to file now wait for you. Give it a new aim or let it go.',
    },
    {
      title: 'A broken rule, in silence',
      message:
        '“{{rule}}” does nothing and says nothing about it. Repair what is in your power: it takes a minute.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Your hand disagrees with “{{rule}}”',
      message:
        '{{count}} times you filed by hand what this rule files elsewhere. Either the rule is wrong or the hand is: decide which.',
    },
    {
      title: '“{{rule}}” was overruled {{count}} times',
      message:
        'A rule you keep correcting is no longer a decision, only a habit of arguing with yourself. Change it or trust it.',
    },
    {
      title: 'Say what you do, do what you said',
      message:
        'The rule “{{rule}}” says one thing; your last {{count}} corrections say another. Bring the two into agreement.',
    },
    {
      title: 'A decision in dispute',
      message:
        'You set “{{rule}}” with a clear head, and {{count}} transactions have since gone another way. Look again, calmly, at which of you was right.',
    },
    {
      title: '{{count}} corrections against “{{rule}}”',
      message:
        'Repetition is information. Let it change the rule, or let the rule change the habit.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Decide once about {{payee}}',
      message:
        'You have filed {{payee}} by hand {{decided}} times, always the same way. What you decide again and again, decide once, with a clear head.',
    },
    {
      title: 'A decision made {{decided}} times',
      message:
        '{{payee}} keeps asking the same question and you keep giving the same answer. A rule would keep your attention for what truly needs it.',
    },
    {
      title: 'Payees ready for a rule: {{count}}',
      message:
        'The same payees keep getting the same category from you, {{payee}} most of all. Spare your judgment for what is new.',
    },
    {
      title: 'Your habit is ready to be a principle',
      message:
        'You file {{payee}} the same way every time ({{decided}} so far). Write it down as a rule and it will hold without effort.',
    },
    {
      title: 'Let a rule carry this',
      message:
        'Payees you file the same way each time: {{count}}, {{payee}} with {{decided}} transactions. A principle settled once does not have to be argued again.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” has met nothing for {{months}} months',
      message:
        'Either the world it was made for has gone, or its conditions miss the mark. Keep your rules true: fix it or remove it.',
    },
    {
      title: 'A rule at rest: “{{rule}}”',
      message:
        'It has not touched a transaction for {{months}} months. Cast away what is superfluous; what remains will be easier to trust.',
    },
    {
      title: '“{{rule}}” stands idle',
      message:
        '{{months}} months without a match while new transactions keep arriving. Test it on your recent ones, then decide.',
    },
    {
      title: 'Is “{{rule}}” still needed?',
      message:
        'Nothing has matched it for {{months}} months. A rule kept out of habit is one more thing to look after.',
    },
    {
      title: 'A decision with nothing to decide',
      message:
        '“{{rule}}” has been silent for {{months}} months. Order means having what you need, and only that.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Your decisions are holding',
      message:
        'Rules filed {{percent}}% of the month’s transactions, and you had no need to overrule them. A decision made once, and kept, frees the mind.',
    },
    {
      title: '{{percent}}% settled in advance',
      message:
        'Most of the month’s transactions were filed by what you decided earlier. That is attention saved for what matters.',
    },
    {
      title: 'Principles at work',
      message:
        'Your rules handled {{percent}}% of transactions without a dispute. Settled principles make for quiet days.',
    },
    {
      title: 'Less to decide',
      message:
        '{{percent}}% of transactions needed no fresh decision. You judged once, well, and the judgment still stands.',
    },
    {
      title: 'Order kept',
      message:
        'Rules filed {{percent}}% of the month, and none was contradicted. Good order looks like nothing happening.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” has no date',
      message:
        'It stands at {{percent}}% with nothing going in. When you do not know what harbour you are making for, no wind is the right wind: name the day you mean to arrive.',
    },
    {
      title: 'A wish, or a goal?',
      message:
        '“{{goal}}” has no deadline and no pace. A goal is a decision with a date; give it one or let it go.',
    },
    {
      title: 'Name the day for “{{goal}}”',
      message:
        'It is {{percent}}% of the way and not moving. What can be done at any time is rarely done at all.',
    },
    {
      title: '“{{goal}}” waits for “someday”',
      message:
        'Nothing has gone into it lately, and no date asks for anything. Someday is not on your calendar; choose a day that is.',
    },
    {
      title: '“{{goal}}” has no harbour',
      message:
        'At {{percent}}%, with no deadline. Know where you are sailing, and the monthly step follows.',
    },
  ],
};
