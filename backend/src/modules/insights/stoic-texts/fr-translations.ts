import type { StoicTextMap } from './types';

export const fr: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'Le mois a débordé de son plan',
      message:
        "Vous aviez prévu {{plannedAmount}} et avez dépensé {{spentAmount}} — {{percent}}% de plus. Le plan a été fait à tête reposée ; laissez-le parler plus fort que l'instant.",
    },
    {
      title: '{{percent}}% au-delà de ce que vous vouliez dépenser',
      message:
        'Les dépenses atteignent {{spentAmount}} pour un plan de {{plannedAmount}}. Regardez quelle limite a cédé la première — la leçon est là.',
    },
    {
      title: 'Votre plan et votre mois ne sont pas d’accord',
      message:
        '{{spentAmount}} dépensés, {{plannedAmount}} prévus. Soit le plan demandait trop peu à la réalité, soit la réalité vous a trop demandé — tranchez, calmement.',
    },
    {
      title: 'Plus de sorties que vous ne le permettiez',
      message:
        "Le mois dépasse de {{percent}}% les {{plannedAmount}} que vous aviez fixés. On ne perd rien à s'arrêter maintenant ; on perd beaucoup à faire comme si de rien n'était.",
    },
    {
      title: 'Une limite fixée, une limite franchie',
      message:
        "Vous vouliez dépenser {{plannedAmount}} ; c'est {{spentAmount}}. La maîtrise de soi, ce n'est pas ne jamais faillir — c'est s'en apercevoir tôt et reprendre le chemin.",
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'Le loisir prend plus que prévu',
      message:
        'Vous vouliez que les loisirs représentent {{planned}}% de vos dépenses ; ils en font {{actual}}%. Le plaisir est le bienvenu comme invité, non comme maître de maison.',
    },
    {
      title: 'Loisir à {{actual}}%, prévu à {{planned}}%',
      message:
        'Le repos mérite sa place quand il vous restaure. Demandez-vous lesquels des plaisirs du mois l’ont fait, et laissez les autres partir sans regret.',
    },
    {
      title: "Le confort dépense plus que l'intention",
      message:
        "Le loisir occupe {{actual}}% des dépenses, contre les {{planned}}% que vous aviez choisis. La modération n'est pas le refus du plaisir — c'est lui garder la taille que vous avez décidée.",
    },
    {
      title: "L'agréable évince le prévu",
      message:
        'Vous aviez accordé {{planned}}% au loisir et il en a pris {{actual}}%. Ce dont on jouit facilement mérite un second regard avant de devenir ce dont on a besoin.',
    },
    {
      title: 'Le loisir a franchi sa ligne',
      message:
        "{{actual}}% du mois sont allés au loisir, pour {{planned}}% prévus. C'est vous qui avez tracé la ligne, et c'est à vous de la tenir.",
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'Le loisir dépasse encore le plan',
      message:
        "Le loisir a dépassé votre plan {{months}} mois sur les {{window}} derniers. Une répétition n'est plus un accident — c'est une habitude qui mérite examen.",
    },
    {
      title: '{{months}} mois sur {{window}} au-dessus du plan loisir',
      message:
        "Ce qui arrive une fois est une circonstance ; ce qui arrive {{months}} fois, c'est un caractère qui se forme. Choisissez ce caractère délibérément.",
    },
    {
      title: 'Le même écart, mois après mois',
      message:
        "Le loisir a dépassé le plan {{months}} mois sur {{window}}. Relevez le plan honnêtement ou changez l'habitude — vivre entre les deux coûte le plus cher.",
    },
    {
      title: 'Un schéma, pas un faux pas',
      message:
        'Sur les {{window}} derniers mois, le loisir a pris plus que prévu à {{months}} reprises. Observez le moment où la décision se prend, pas seulement la facture qui suit.',
    },
    {
      title: "L'habitude vote contre votre plan",
      message:
        'Le loisir a battu le plan {{months}} fois en {{window}} mois. Les habitudes se construisent un choix à la fois ; elles se défont de la même manière.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'La vertu reçoit moins que prévu',
      message:
        'Vous aviez réservé {{planned}}% de votre budget à la santé, à l’étude et au reste ; cela fait {{actual}}%. Une intention ne compte qu’une fois menée à bien.',
    },
    {
      title: 'Vertu à {{actual}}% sur {{planned}}% prévus',
      message:
        'L’argent que vous destiniez à ce qui vous rend meilleur attend toujours. Il n’y a pas de meilleur moment que maintenant pour bien le dépenser.',
    },
    {
      title: "Le bien prévu n'est pas encore dépensé",
      message:
        "La santé, l'apprentissage et la générosité devaient recevoir {{planned}}% des dépenses ; ils ont reçu {{actual}}%. Accomplissez l'un d'eux cette semaine, délibérément.",
    },
    {
      title: "L'intention sans l'acte",
      message:
        'La vertu représente {{actual}}% des dépenses, contre les {{planned}}% que vous aviez choisis. Ce que nous estimons se voit dans ce que nous payons réellement.',
    },
    {
      title: 'Il reste de la place pour l’essentiel',
      message:
        "Seulement {{actual}}% sont allés à la vertu, pour {{planned}}% prévus. Un livre, un bilan de santé, un don à quelqu'un dans le besoin — le plan a déjà dit oui.",
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'La vertu est encore remise à plus tard',
      message:
        "Les dépenses pour la santé, l'apprentissage et les autres restent sous votre plan depuis {{months}} mois d'affilée. Ce que vous remettez sans cesse, vous l'avez en fait déjà refusé.",
    },
    {
      title: '{{months}} mois de vertu remise à plus tard',
      message:
        "Chaque mois, le plan faisait place à ce qui vous rend meilleur, et chaque mois cette place est restée vide. Le temps est la seule chose qu'on ne budgète pas deux fois.",
    },
    {
      title: 'Le meilleur de vous attend encore',
      message:
        'La vertu est sous le plan depuis {{months}} mois. Commencez petit et sûr plutôt que grand et plus tard.',
    },
    {
      title: 'Les bonnes intentions vieillissent',
      message:
        "Depuis {{months}} mois, la santé, l'apprentissage et la générosité reçoivent moins que prévu. Choisissez-en une et financez-la en premier le mois prochain, avant tout le reste.",
    },
    {
      title: 'La vertu cède toujours à « plus tard »',
      message:
        "{{months}} mois d'affilée sous le plan. « Plus tard » est l'endroit où les bonnes intentions vont se faire oublier — donnez à celle-ci une date.",
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: "Votre plan n'a pas de place pour la vertu",
      message:
        "Aucun de vos budgets ne sert la santé, l'apprentissage ou les autres. Un plan montre ce à quoi nous tenons — pensez à donner à la vertu sa propre ligne.",
    },
    {
      title: 'Des budgets pour tout, sauf pour le bien',
      message:
        "La nécessité, le travail et le loisir ont leurs limites ; la vertu n'en a aucune. Ce qui n'est jamais prévu a tendance à ne jamais arriver.",
    },
    {
      title: 'Prévoyez pour ce qui vous rend meilleur',
      message:
        "Il n'y a encore aucun budget dans la classe vertu. Même modeste — des livres, du sport, un don — il transforme un souhait en engagement.",
    },
    {
      title: 'Le plan se tait sur la vertu',
      message:
        'Vous budgétez ce que vous devez et ce que vous aimez, pas encore la personne que vous voulez devenir. Un modeste budget vertu changerait cela.',
    },
    {
      title: "La vertu n'a pas de budget",
      message:
        "Les dépenses pour la santé, l'apprentissage ou les autres ne sont prévues nulle part. Choisissez-en une et donnez-lui une limite que vous seriez heureux d'atteindre.",
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'La nécessité coûte plus que prévu',
      message:
        "Vous aviez prévu {{planned}}% des dépenses pour la nécessité ; elle en prend {{actual}}%. Vérifiez que chaque poste est encore un besoin et n'est pas devenu, sans bruit, un confort.",
    },
    {
      title: 'Nécessité à {{actual}}%, prévue à {{planned}}%',
      message:
        "Ce que la vie exige est souvent moins que ce à quoi l'on s'habitue. Regardez d'un œil neuf votre plus gros poste de nécessité.",
    },
    {
      title: "L'essentiel enfle",
      message:
        'La nécessité occupe {{actual}}% du mois, contre les {{planned}}% attendus. Un besoin qui ne cesse de grandir mérite une question.',
    },
    {
      title: 'Les besoins débordent du plan',
      message:
        'Prévu {{planned}}%, réel {{actual}}%. Soit le plan a sous-estimé les vrais coûts, soit certaines envies voyagent sous le nom de besoins.',
    },
    {
      title: 'Plus dépensé pour le « il faut » que prévu',
      message:
        'La nécessité a pris {{actual}}% des dépenses au lieu de {{planned}}%. Séparez ce qui doit vraiment être de ce qui a simplement toujours été.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'La nécessité grimpe peu à peu',
      message:
        "Les dépenses de nécessité augmentent depuis {{months}} mois d'affilée, de {{percent}}% au total. Les besoins grandissent en silence quand personne ne leur demande de se justifier.",
    },
    {
      title: '+{{percent}}% de nécessité en {{months}} mois',
      message:
        'Chaque pas semblait petit ; ensemble, ils ne le sont pas. Prenez la plus grosse dépense nécessaire récurrente et demandez-vous si elle doit encore coûter autant.',
    },
    {
      title: 'Le plancher de vos dépenses monte',
      message:
        'La nécessité a augmenté {{months}} mois de suite (+{{percent}}%). Un plancher qui monte laisse moins de place à tout ce que vous choisissez librement.',
    },
    {
      title: "Les besoins s'étendent",
      message:
        "{{months}} mois de hausse, {{percent}}% au total. L'épreuve stoïcienne est simple : le choisiriez-vous à nouveau aujourd'hui, en connaissant son prix ?",
    },
    {
      title: 'De petites hausses, une direction nette',
      message:
        "La nécessité a augmenté de {{percent}}% en {{months}} mois. La direction compte plus qu'un mois isolé — celle-ci vaut la peine d'être corrigée tôt.",
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'Le travail coûte plus que prévu',
      message:
        'Vous aviez prévu {{planned}}% des dépenses pour le travail ; il en prend {{actual}}%. Outils et services doivent mériter leur place — vérifiez lesquels le font.',
    },
    {
      title: 'Travail à {{actual}}%, prévu à {{planned}}%',
      message:
        "Investir dans son travail est bon quand cela rapporte. Passez en revue ce que vous payez sans plus l'utiliser.",
    },
    {
      title: 'Le budget travail est tendu',
      message:
        "Le travail a pris {{actual}}% au lieu de {{planned}}%. L'application, c'est bien faire le travail, pas acheter chaque outil pour le faire.",
    },
    {
      title: 'Les outils dépassent le plan',
      message:
        "Prévu {{planned}}%, dépensé {{actual}}% pour le travail. Demandez à chaque dépense : m'aide-t-elle à travailler, ou donne-t-elle seulement l'impression d'avancer ?",
    },
    {
      title: 'Les coûts du travail ont dérivé',
      message:
        'Le travail occupe {{actual}}% des dépenses pour {{planned}}% prévus. Un rapide examen maintenant en évite un plus lourd plus tard.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '« {{category}} » dépasse encore sa limite',
      message:
        "« {{category}} » a dépassé le budget {{months}} mois sur les {{window}} derniers. Soit la limite est fausse, soit le désir l'est — décidez lequel.",
    },
    {
      title: '« {{category}} » : hors budget {{months}} mois sur {{window}}',
      message:
        "Une limite toujours franchie n'est pas une limite, seulement un souhait. Rendez-la honnête — relevez-la exprès ou tenez-la exprès.",
    },
    {
      title: 'Le même budget cède encore',
      message:
        '« {{category}} » a dépassé sa limite {{months}} fois en {{window}} mois. La répétition est une information ; servez-vous-en.',
    },
    {
      title: '« {{category}} » demande votre attention',
      message:
        "Hors budget {{months}} mois sur {{window}}. Observez le moment qui précède l'achat — c'est le seul endroit où l'habitude peut changer.",
    },
    {
      title: 'Un schéma dans « {{category}} »',
      message:
        '{{months}} dépassements en {{window}} mois. Nous devenons ce que nous répétons ; décidez ce que cette catégorie doit dire de vous.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '« {{category}} » sera épuisé vers le {{day}}',
      message:
        "Vous avez dépensé {{spentAmount}} sur {{limitAmount}}, et à ce rythme la limite s'épuise vers le {{day}} du mois. Ralentir maintenant est plus facile que s'arrêter plus tard.",
    },
    {
      title: '« {{category}} » a de l’avance sur le mois',
      message:
        "{{spentAmount}} déjà partis d'une limite de {{limitAmount}}. À ce rythme, elle sera épuisée vers le {{day}} — le reste du mois est encore à vous de le façonner.",
    },
    {
      title: 'Point sur le rythme : « {{category}} »',
      message:
        'Au rythme actuel, le budget de {{limitAmount}} tiendra jusque vers le {{day}} du mois. La prévoyance est la forme de discipline la moins chère.',
    },
    {
      title: '« {{category}} » dépense l’avenir',
      message:
        "{{spentAmount}} sur {{limitAmount}} dépensés ; la limite s'arrête vers le {{day}}. Ce que vous ferez cette semaine décidera si cela arrive.",
    },
    {
      title: 'Alerte précoce pour « {{category}} »',
      message:
        "Au rythme actuel, la limite de {{limitAmount}} n'atteindra pas la fin du mois — elle s'épuise vers le {{day}}. Ajustez tant que cela coûte peu.",
    },
  ],
  'stoic.budget_unused': [
    {
      title: "« {{category}} » n'est pas utilisé",
      message:
        "Le budget « {{category}} » n'a vu aucune dépense depuis {{months}} mois. Soit vous l'avez dépassé, soit c'est une intention qui attend encore — décidez laquelle.",
    },
    {
      title: 'Un budget vide : « {{category}} »',
      message:
        '{{months}} mois sans une seule dépense. Un plan devrait décrire la vie que vous menez ou celle que vous construisez — laquelle est-ce ici ?',
    },
    {
      title: '« {{category}} » reste immobile',
      message:
        "Rien de dépensé ici depuis {{months}} mois. Si c'était de la retenue, bravo ; si c'était de la négligence, agissez.",
    },
    {
      title: 'Prévu, mais pas vécu',
      message:
        '« {{category}} » a une limite et aucune dépense depuis {{months}} mois. Gardez le plan fidèle : supprimez-le ou utilisez-le.',
    },
    {
      title: '« {{category}} » : {{months}} mois de silence',
      message:
        "Un budget jamais touché occupe tout de même une place dans votre plan. Libérez la place ou honorez l'intention.",
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% des dépenses sans limite',
      message:
        '{{unbudgetedAmount}} du mois sont allés à des catégories que nul budget ne surveille. Ce que vous n’avez pas regardé, vous ne pouvez pas le juger.',
    },
    {
      title: "Une grande part du mois n'est pas planifiée",
      message:
        '{{percent}}% des dépenses — {{unbudgetedAmount}} — échappent à tout budget. Donnez une limite à la plus grosse part, et le plan verra davantage de votre vie.',
    },
    {
      title: 'Des dépenses hors du plan',
      message:
        "Les budgets ne couvrent qu'une partie de vos dépenses ; {{unbudgetedAmount}} ({{percent}}%) ne sont pas mesurés. Étendez le plan là où l'argent va vraiment.",
    },
    {
      title: "Le plan ne voit qu'une partie du tableau",
      message:
        '{{percent}}% des dépenses du mois n’ont pas de budget. Voir clair vient avant bien juger.',
    },
    {
      title: '{{unbudgetedAmount}} dépensés sans limite',
      message:
        "Cela représente {{percent}}% du mois. Vous n'avez pas à le restreindre — seulement à décider combien vous en voulez vraiment.",
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '« {{category}} » fait l’essentiel de votre loisir',
      message:
        '{{percent}}% des dépenses de loisirs sont allés à « {{category}} ». Profitez-en, mais vérifiez que vous pourriez vous en détacher.',
    },
    {
      title: 'Un plaisir domine',
      message:
        "« {{category}} » prend {{percent}}% de tout ce que vous avez dépensé en loisir. Demandez-vous s'il vous réjouit encore ou s'il est devenu une routine.",
    },
    {
      title: 'Le loisir repose sur « {{category}} »',
      message:
        '{{percent}}% du loisir au même endroit. Ce dont nous ne pouvons nous passer a prise sur nous — vérifiez que la prise reste légère.',
    },
    {
      title: '« {{category}} » : {{percent}}% du loisir',
      message:
        'Une seule source de plaisir en prend presque tout. Passez-vous-en un temps et voyez ce qu’elle vous donne vraiment.',
    },
    {
      title: "Votre repos n'a qu'une adresse",
      message:
        'La plus grande part de l’argent des loisirs, {{percent}}%, va à « {{category}} ». Vous n’êtes libre d’un plaisir que si vous pouviez vous en passer.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Certaines dépenses ne sont pas encore jugées',
      message:
        'Catégories sans classe : {{count}}. Décidez dans Budgets ce qui relève de la nécessité, du travail, de la vertu ou du loisir.',
    },
    {
      title: 'Catégories en attente de votre jugement : {{count}}',
      message:
        'Elles ont des dépenses mais pas de classe, et le conseil ne peut donc pas les peser. Une minute dans Budgets suffit.',
    },
    {
      title: 'Nommez ce que sert votre argent',
      message:
        'Catégories encore non classées : {{count}}. Le jugement commence par appeler les choses par leur nom.',
    },
    {
      title: 'Dépenses non jugées — catégories : {{count}}',
      message:
        "Est-ce un besoin, votre travail, une vertu ou un plaisir ? Vous seul pouvez le dire — et le plan s'éclaircit dès que vous le faites.",
    },
    {
      title: "Quelques catégories n'ont pas de classe",
      message:
        "Hors des quatre classes : {{count}}. Classez-les dans Budgets pour que chaque dépense soit vue pour ce qu'elle est.",
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Petits achats chez {{merchant}} : {{count}}',
      message:
        'Chacun semblait insignifiant ; ensemble, ils font {{totalAmount}} sur le mois. C’est dans les petites habitudes sans examen que l’argent s’en va le plus discrètement.',
    },
    {
      title: '{{merchant}} : {{count}} fois dans le mois',
      message:
        '{{totalAmount}} en petites sommes. Demandez-vous si chaque visite était un choix ou un réflexe : seul le premier est la liberté.',
    },
    {
      title: 'Petit à petit : {{totalAmount}}',
      message:
        "Achats chez {{merchant}} : {{count}}. Aucun ne compte à lui seul ; l'habitude, si. Décidez à quelle fréquence vous le voulez vraiment.",
    },
    {
      title: 'Une habitude chez {{merchant}}',
      message:
        '{{count}} achats, {{totalAmount}} au total. Essayez d’en sauter un sur trois et voyez s’il vous manque.',
    },
    {
      title: "Les petites choses s'additionnent",
      message:
        '{{merchant}} vous a vu {{count}} fois, pour {{totalAmount}}. La maîtrise des grandes décisions se bâtit sur de petites comme celles-ci.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Les week-ends portent {{percent}}% du loisir',
      message:
        "L'essentiel de vos dépenses de loisir a lieu le samedi et le dimanche. Le repos est bon ; vérifiez que c'est du repos et non une compensation de la semaine.",
    },
    {
      title: 'Le loisir vit le week-end',
      message:
        '{{percent}}% des dépenses de loisir tombent le week-end. Prévoyez un peu le week-end : il coûtera moins et donnera plus.',
    },
    {
      title: 'Le week-end paie pour la semaine',
      message:
        "Les week-ends prennent {{percent}}% de ce que vous dépensez en loisir. Si la semaine a besoin d'être réparée chaque samedi, regardez la semaine.",
    },
    {
      title: 'Samedi et dimanche : {{percent}}% du loisir',
      message:
        "Les jours libres invitent aux dépenses libres. Décidez avant le week-end à quoi il doit servir, et laissez l'argent suivre.",
    },
    {
      title: 'Un schéma de week-end',
      message:
        '{{percent}}% des dépenses de loisir ont lieu le week-end. Plus de légèreté en semaine rend souvent les week-ends moins coûteux.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} a pris {{percent}}% du mois',
      message:
        '{{totalAmount}} sont allés à un seul commerçant pour le loisir. Quand un seul endroit détient autant de votre argent, demandez-vous combien il détient aussi de votre attention.',
    },
    {
      title: 'Un seul endroit, {{totalAmount}}',
      message:
        '{{merchant}} représente {{percent}}% des dépenses du mois. Cela vaut-il cette part du travail de votre vie ?',
    },
    {
      title: '{{merchant}} mène vos dépenses',
      message:
        '{{percent}}% du mois — {{totalAmount}} — y sont allés. Rien de mal à en profiter, tant que vous le choisiriez à nouveau.',
    },
    {
      title: 'Une grosse part chez {{merchant}}',
      message:
        '{{totalAmount}}, soit {{percent}}% des dépenses, en un seul lieu de loisir. Pesez le plaisir contre le prix, calmement.',
    },
    {
      title: '{{percent}}% chez {{merchant}}',
      message:
        "Ce seul commerçant a pris {{totalAmount}}. La liberté, c'est pouvoir passer devant sans entrer quand vous le décidez.",
    },
  ],
  'stoic.income_drop': [
    {
      title: 'Les revenus ont baissé, pas les dépenses',
      message:
        "Les revenus ont chuté de {{percent}}% à {{incomeAmount}}, mais les dépenses sont restées à {{expenseAmount}}. La fortune a changé d'avis ; vos dépenses ne l'ont pas encore remarqué.",
    },
    {
      title: 'Revenus en baisse de {{percent}}%',
      message:
        '{{incomeAmount}} sont entrés, {{expenseAmount}} sont sortis. Ce que la fortune donne, elle peut le reprendre — ajustez vos dépenses à ce qui est, non à ce qui était.',
    },
    {
      title: 'Un mois plus maigre, les mêmes habitudes',
      message:
        'Les revenus sont inférieurs de {{percent}}% ({{incomeAmount}}), tandis que les dépenses se maintiennent à {{expenseAmount}}. Les revenus ne dépendent pas de vous ; la réponse, si.',
    },
    {
      title: 'La fortune a tourné',
      message:
        "Vous avez gagné {{percent}}% de moins que d'habitude, mais dépensé {{expenseAmount}} comme avant. Réduisez maintenant, tant que c'est un choix et non une nécessité.",
    },
    {
      title: "Les dépenses n'ont pas suivi les revenus",
      message:
        'Les revenus sont tombés à {{incomeAmount}} ({{percent}}% de moins) ; les dépenses sont de {{expenseAmount}}. Réglez la voile sur le vent que vous avez réellement.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Abonnements : {{monthlyAmount}} par mois',
      message:
        'Abonnements ({{count}}) : {{percent}}% de vos dépenses mensuelles. Chacun se renouvelle sans vous demander — interrogez-vous vous-même sur chacun.',
    },
    {
      title: "{{percent}}% des dépenses se renouvellent d'elles-mêmes",
      message:
        "Abonnements : {{count}}, soit {{monthlyAmount}} par mois. Gardez ceux auxquels vous vous abonneriez à nouveau aujourd'hui.",
    },
    {
      title: 'Discret, récurrent, {{monthlyAmount}}',
      message:
        'Abonnements ({{count}}) : {{percent}}% de votre mois. Le confort est un bon serviteur et un maître coûteux.',
    },
    {
      title: 'Abonnements à revoir : {{count}}',
      message:
        'Ensemble, ils font {{monthlyAmount}} par mois, {{percent}}% des dépenses. Résiliez-en un que vous utilisez à peine et voyez combien peu il vous manque.',
    },
    {
      title: 'Ce qui se renouvelle tout seul',
      message:
        '{{monthlyAmount}} par mois pour vos abonnements ({{count}}). Une dépense automatique mérite un examen délibéré.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Votre réussite pourrait aller un peu plus loin',
      message:
        "En {{months}} mois, vous avez gardé {{savingsPercent}}% de vos revenus, mais presque rien n'est allé aux autres. La richesse se tient mieux dans des mains ouvertes — peut-être un cadeau ou un don ce mois-ci ?",
    },
    {
      title: 'Bien gagner, peu donner',
      message:
        "{{incomeAmount}} sont entrés en {{months}} mois et {{givenAmount}} sont allés aux autres. Si vous aidez d'une manière que l'application ne voit pas, ignorez ceci ; sinon, votre plan a de la place pour cela.",
    },
    {
      title: 'Un bon moment pour être généreux',
      message:
        "Vous avez épargné {{savingsPercent}}% de vos revenus — signe d'une main sûre. Une petite part de cela, donnée à quelqu'un qui en a besoin, donnerait plus de sens à cette constance.",
    },
    {
      title: "Personne d'autre dans le tableau pour l'instant",
      message:
        'Les {{months}} derniers mois montrent des revenus et une épargne bien tenus, mais ni dons ni cadeaux. Nous sommes faits les uns pour les autres ; un modeste présent suffit pour commencer.',
    },
    {
      title: 'De la place pour la bonté',
      message:
        "Seulement {{givenAmount}} sur {{incomeAmount}} sont allés à l'aide aux autres. Pensez à un petit don régulier — la générosité devient plus facile avec l'habitude, comme toute vertu.",
    },
  ],
  'stoic.goal_behind': [
    {
      title: '« {{goal}} » prend du retard',
      message:
        'Il faut {{requiredAmount}} par mois, et vous versez environ {{paceAmount}}. À ce rythme, il arrive avec {{monthsLate}} mois de retard. Le rythme dépend de vous.',
    },
    {
      title: '« {{goal}} » : {{monthsLate}} mois de retard à ce rythme',
      message:
        "Requis : {{requiredAmount}} par mois, réel : environ {{paceAmount}}. Déplacez la date honnêtement ou déplacez plus d'argent délibérément.",
    },
    {
      title: "L'objectif et le rythme ne s'accordent pas",
      message:
        "« {{goal}} » demande {{requiredAmount}} par mois ; il reçoit {{paceAmount}}. Un objectif n'est réel que par le pas mensuel qui y mène.",
    },
    {
      title: '« {{goal}} » demande un pas plus ferme',
      message:
        "{{paceAmount}} par mois contre les {{requiredAmount}} nécessaires. Le mois prochain, payez d'abord l'objectif, avant tout ce qui est facultatif.",
    },
    {
      title: 'En retard sur « {{goal}} »',
      message:
        'Le rythme actuel ({{paceAmount}}/mois) l’amène avec {{monthsLate}} mois de retard. Ce qui dépend de vous, c’est le prochain pas, non toute la route.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: "« {{goal}} » n'entre pas dans le plan",
      message:
        "Il faut {{requiredAmount}} par mois, mais après vos budgets il ne reste que {{freeAmount}}. Changez la date, la cible ou les budgets — espérer n'est pas un plan.",
    },
    {
      title: '« {{goal}} » demande plus que vous n’avez de libre',
      message:
        "{{requiredAmount}} requis chaque mois, {{freeAmount}} disponibles. Vouloir tout à la fois, c'est ne rien accomplir ; choisissez.",
    },
    {
      title: 'Les chiffres disent non — pour l’instant',
      message:
        "« {{goal}} » demande {{requiredAmount}} par mois ; votre marge libre est de {{freeAmount}}. Ajustez ce qui dépend de vous : l'échéance ou les autres limites.",
    },
    {
      title: '« {{goal}} » demande une décision',
      message:
        "À {{requiredAmount}} par mois, il dépasse les {{freeAmount}} qui restent après les budgets. Un objectif choisi les yeux ouverts vaut mieux qu'un objectif maintenu par l'illusion.",
    },
    {
      title: 'Un rythme impossible pour « {{goal}} »',
      message:
        "Requis : {{requiredAmount}} par mois, libre : {{freeAmount}}. Une arithmétique honnête aujourd'hui épargne la déception demain.",
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Votre solde passe sous zéro le {{date}}',
      message:
        'Avec les revenus et les dépenses tels qu’ils vont, le solde prévu descend jusqu’à {{lowestAmount}}. Préparez-vous dès maintenant, tant que ce n’est qu’une prévision.',
    },
    {
      title: 'Un manque approche : {{date}}',
      message:
        'Les paiements et les dépenses courantes dépassent ce qui entre, avec un plus bas à {{lowestAmount}}. Anticiper l’épreuve est la façon de lui ôter son pouvoir.',
    },
    {
      title: 'Préparez le {{date}}',
      message:
        "Ce jour-là, le solde prévu atteint {{lowestAmount}}. Déplacer un paiement, retenir une envie, mettre de l'argent de côté — tout cela est en votre pouvoir aujourd'hui.",
    },
    {
      title: 'La prévision passe sous zéro',
      message:
        'Le solde tombe à {{lowestAmount}} vers le {{date}}. La réponse sereine est la réponse précoce.',
    },
    {
      title: 'Anticipez le trou du {{date}}',
      message:
        'Solde le plus bas prévu : {{lowestAmount}}. Ce qui est prévu peut être affronté avec calme ; ce qui nous surprend, rarement.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Vous tenez parole envers vous-même',
      message:
        "Depuis {{months}} mois d'affilée, vos dépenses restent dans le plan que vous vous êtes fixé. Voilà à quoi ressemble la maîtrise de soi.",
    },
    {
      title: '{{months}} mois dans le plan',
      message:
        'Mois après mois, ce que vous vouliez et ce que vous avez fait concordent. La constance est plus discrète que la volonté, et dure plus longtemps.',
    },
    {
      title: "Le plan et la vie s'accordent",
      message:
        "{{months}} mois consécutifs dans vos limites. Un plan si bien tenu n'est plus une contrainte — c'est votre façon de vivre.",
    },
    {
      title: 'Constant depuis {{months}} mois',
      message:
        'Vos budgets tiennent depuis {{months}} mois. Gardez la même attention ; elle porte ses fruits.',
    },
    {
      title: 'Une discipline qui dure',
      message:
        '{{months}} mois sans rompre votre plan. Peu de choses libèrent autant que de pouvoir se fier à ses propres décisions.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Votre argent suit vos valeurs',
      message:
        'L’argent mis au service de la vertu a représenté {{actual}}% de vos dépenses, pas moins que les {{planned}}% prévus. Bien dépensé.',
    },
    {
      title: 'La vertu a reçu toute sa part',
      message:
        "{{actual}}% pour la santé, l'apprentissage et les autres, pour {{planned}}% prévus. Ce à quoi vous tenez, vous l'avez payé.",
    },
    {
      title: 'Dépensé pour devenir meilleur',
      message:
        'La santé, l’étude et le reste ont reçu {{actual}}% des dépenses du mois (prévu : {{planned}}%). La vertu ne s’achète pas, mais on peut la servir.',
    },
    {
      title: 'Intention accomplie',
      message:
        'Vous aviez prévu {{planned}}% pour la vertu et dépensé {{actual}}%. Les bonnes intentions survivent rarement à un mois — la vôtre, si.',
    },
    {
      title: "Le meilleur usage de l'argent",
      message:
        '{{actual}}% sont allés à ce qui vous rend meilleur, vous et les autres. Continuez de le choisir.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'Le loisir à sa place',
      message:
        'Le loisir représente {{actual}}% des dépenses, sous les {{planned}}% que vous lui accordiez. Vous profitez des choses sans vous laisser gouverner par elles.',
    },
    {
      title: 'Le plaisir, à sa juste taille',
      message:
        "Le loisir a pris {{actual}}% pour {{planned}}% prévus. La modération n'est pas se priver — c'est choisir.",
    },
    {
      title: 'Du repos sans excès',
      message:
        "{{actual}}% pour le loisir, sous votre limite de {{planned}}%. Le plaisir a meilleur goût quand ce n'est pas lui qui commande.",
    },
    {
      title: 'La tempérance, en silence',
      message:
        "Vous aviez donné {{planned}}% au loisir et il n'en a utilisé que {{actual}}%. Cette marge est une liberté que vous avez gardée.",
    },
    {
      title: 'Le loisir sous le plan',
      message:
        'À {{actual}}% des dépenses, le loisir est resté sous les {{planned}}% que vous aviez fixés. Bien tenu.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% sous le plan',
      message:
        'Vous avez dépensé {{savedAmount}} de moins que ce que vous vous étiez permis pour le mois. Ne pas avoir besoin de tout ce que l’on pourrait avoir est une forme de richesse.',
    },
    {
      title: '{{savedAmount}} non dépensés',
      message:
        "Le mois se termine {{percent}}% sous le plan. Ce que vous n'avez pas dépensé reste à vous de le diriger.",
    },
    {
      title: 'Moins que ce que vous vous accordiez',
      message:
        "Les dépenses sont {{percent}}% sous le plan — {{savedAmount}} gardés. Donnez un but à cette marge avant que l'habitude ne la réclame.",
    },
    {
      title: 'Le plan avait de la marge',
      message:
        '{{savedAmount}} sous vos limites pour le mois. La retenue qui semble facile est celle qui dure.',
    },
    {
      title: 'Plus léger que prévu',
      message:
        'Il vous a fallu {{percent}}% de moins que budgété. Pensez à diriger ces {{savedAmount}} vers un objectif.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '« {{goal}} » est dans les temps',
      message:
        "Vous êtes à {{percent}}% du chemin, au rythme dont l'objectif a besoin. Des pas réguliers, chaque mois, mènent loin.",
    },
    {
      title: 'En bonne voie pour « {{goal}} »',
      message:
        "{{percent}}% accomplis, et le rythme tient. Continuez à payer l'objectif en premier ; cela fonctionne.",
    },
    {
      title: '« {{goal}} » : {{percent}}% et régulier',
      message: "L'objectif reçoit chaque mois ce dont il a besoin. La patience fait son œuvre.",
    },
    {
      title: "L'objectif avance comme prévu",
      message:
        '« {{goal}} » est financé à {{percent}}% et dans les temps. Ce qui se fait un peu chaque mois ne peut être arrêté par une mauvaise semaine.',
    },
    {
      title: 'Un progrès digne de confiance',
      message:
        '« {{goal}} » en est à {{percent}}%, au bon rythme. Vous le construisez de la seule manière qui marche — peu à peu.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: "Moins d'achats impulsifs chez {{merchant}}",
      message:
        'De {{before}} achats en un mois à environ {{after}}. Une habitude relâchée est une liberté gagnée.',
    },
    {
      title: '{{merchant}} : {{before}} → {{after}}',
      message:
        "Vous y allez moins qu'avant. Chaque réflexe évité est une petite victoire du choix sur l'habitude.",
    },
    {
      title: 'La petite habitude rétrécit',
      message:
        'Les achats chez {{merchant}} sont passés de {{before}} à environ {{after}}. Continuez — cela devient plus facile.',
    },
    {
      title: 'Le choix plutôt que le réflexe',
      message:
        "Chez {{merchant}}, vous êtes passé de {{before}} achats à environ {{after}}. C'est la maîtrise, bâtie une décision à la fois.",
    },
    {
      title: 'Moins de petites dépenses',
      message:
        "{{merchant}} vous a vu environ {{after}} fois au lieu de {{before}}. Les petites victoires s'accumulent.",
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Vous vous êtes adapté à un mois plus maigre',
      message:
        'Les revenus ont baissé de {{incomePercent}}%, et vous avez réduit les dépenses de {{expensePercent}}%. À un changement de fortune, vous avez répondu par un changement de cap.',
    },
    {
      title: 'Du sang-froid quand les revenus ont baissé',
      message:
        'Revenus en baisse de {{incomePercent}}%, dépenses en baisse de {{expensePercent}}%. Vous vous êtes ajusté à ce qui est, non à ce qui était.',
    },
    {
      title: 'La fortune a changé ; vous aussi',
      message:
        "Une baisse de {{incomePercent}}% des revenus a rencontré une baisse de {{expensePercent}}% des dépenses. C'est l'égalité d'âme en chiffres.",
    },
    {
      title: 'Bien gouverné',
      message:
        'Quand les revenus ont baissé de {{incomePercent}}%, les dépenses ont suivi ({{expensePercent}}% de moins). Le vent ne dépendait pas de vous ; la voile, si.',
    },
    {
      title: 'Les dépenses ont suivi les revenus à la baisse',
      message:
        "Vous avez dépensé {{expensePercent}}% de moins quand les revenus ont baissé de {{incomePercent}}%. S'adapter tôt est la voie la plus sereine.",
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'La nécessité reste stable',
      message:
        'Depuis {{months}} mois, vos dépenses essentielles ont à peine bougé. Un plancher stable vous laisse de la liberté au-dessus.',
    },
    {
      title: 'Des besoins maîtrisés',
      message:
        'Les dépenses de nécessité sont restées au même niveau pendant {{months}} mois. Des besoins qui ne grandissent pas sont des besoins que vous maîtrisez.',
    },
    {
      title: '{{months}} mois d’essentiel stable',
      message:
        'Le loyer, la nourriture et les factures sont restés où ils étaient. La stabilité discrète est aussi une réussite.',
    },
    {
      title: 'Pas de dérive dans la nécessité',
      message:
        '{{months}} mois sans glissement dans ce que la vie exige. Sur ce terrain, tout le reste se planifie plus facilement.',
    },
    {
      title: 'Un plancher solide',
      message:
        'Les dépenses essentielles sont stables depuis {{months}} mois. Vous ne laissez pas les conforts se faire passer pour des besoins.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Généreux avec ce que vous gagnez',
      message:
        "En {{months}} mois, {{percent}}% de vos revenus — {{givenAmount}} — sont allés à l'aide aux autres. C'est de l'argent employé au mieux.",
    },
    {
      title: '{{givenAmount}} donnés aux autres',
      message:
        'Vous avez partagé {{percent}}% de vos revenus en {{months}} mois. Une bonté visible dans les chiffres est une bonté pratiquée, pas seulement ressentie.',
    },
    {
      title: 'Mains ouvertes',
      message:
        "Dons et cadeaux ont représenté {{percent}}% de vos revenus ces derniers temps. Ce que vous donnez est la part de votre richesse qu'aucun malheur ne peut prendre.",
    },
    {
      title: 'La générosité fait partie de votre plan',
      message:
        '{{givenAmount}} aux autres en {{months}} mois. Gardez cela — le bien que vous faites aux autres, vous le faites aussi à vous-même.',
    },
    {
      title: 'Bien donné',
      message:
        "{{percent}}% de ce que vous avez gagné est allé à l'aide aux autres. Peu d'habitudes en disent plus sur une personne.",
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Rien à corriger',
      message: 'Vos dépenses correspondent à ce que vous aviez prévu. Continuez ainsi.',
    },
    {
      title: "L'intention et l'action concordent",
      message: 'Le mois ressemble à ce que vous aviez prévu. Cet accord est tout l’enjeu.',
    },
    {
      title: 'Un mois calme',
      message:
        "Ni excès, ni négligence qui vaille d'être mentionnée. Bravo — gardez la même attention pour la suite.",
    },
    {
      title: 'Tout est en ordre',
      message:
        'Votre plan a tenu et rien ne demande de correction. Profitez du calme que vous avez mérité.',
    },
    {
      title: 'Main sûre',
      message:
        'Le mois a suivi votre plan. Les bonnes habitudes rendent les bons mois ordinaires en apparence.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Gardez votre part d’abord',
      message:
        'Sur {{months}} mois, vous avez gardé {{savingsPercent}}% de vos revenus. L’avertissement de Sénèque : il est trop tard pour épargner quand on touche le fond du tonneau. Mettez {{tenthAmount}} de côté le jour où l’argent arrive.',
    },
    {
      title: 'Épargner en haut du tonneau',
      message:
        'Seulement {{savingsPercent}}% de vos revenus vous sont restés. Une économie qui attend le reste vient trop tard ; {{tenthAmount}} par mois, mis de côté en premier, la fait commencer dès maintenant.',
    },
    {
      title: 'Ce qui est à vous, gardez-le',
      message:
        'Sénèque conseille de garder ce qui vous appartient vraiment et de commencer tôt. Récemment, {{savingsPercent}}% de vos revenus vous sont restés ; commencez par {{tenthAmount}} le jour de la paie et laissez les dépenses s’arranger autour du reste.',
    },
    {
      title: 'Commencez avant la lie',
      message:
        'Vous avez gardé {{savingsPercent}}% en {{months}} mois. Épargner ne dépend de vous que tant qu’il reste quelque chose à épargner : mettez {{tenthAmount}} de côté avant toute autre chose.',
    },
    {
      title: '{{savingsPercent}}% gardés, et le tonneau se vide',
      message:
        '{{tenthAmount}} par mois, un dixième des revenus, mis de côté avant toute facture. Ce que l’on garde en premier ne dépend pas de ce que le mois laisse.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Préparez-vous quand tout est calme',
      message:
        'Votre réserve couvre environ {{cushionDays}} jours de dépenses. Sénèque : l’âme doit s’endurcir dans les temps sans souci. Trois mois de dépenses, c’est {{targetAmount}}.',
    },
    {
      title: 'Une réserve de {{cushionDays}} jours',
      message:
        'La fortune ne s’annonce pas. Visez {{targetAmount}}, trois mois de dépenses, tant que rien ne presse : c’est alors que c’est facile.',
    },
    {
      title: '« Est-ce là l’état que je craignais ? »',
      message:
        'Sénèque faisait répéter la pauvreté à Lucilius pour qu’elle perde sa terreur. Avec {{cushionDays}} jours de réserve, un mois difficile ne serait pas une simple répétition. Visez {{targetAmount}}.',
    },
    {
      title: 'Prévoyez le mois difficile',
      message:
        'Vos économies tiendraient environ {{cushionDays}} jours. Ce qui est prévu arrive doucement ; {{targetAmount}} vous porteraient pendant trois mois.',
    },
    {
      title: 'Bâtissez le mur avant la tempête',
      message:
        'Environ {{cushionDays}} jours sont couverts. Perdre ses revenus ne dépend pas de vous ; la réserve, si. Trois mois de dépenses font {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Les envies dépassent les revenus',
      message:
        'Les dépenses ont augmenté de {{expenseGrowth}}% sur le dernier trimestre, tandis que les revenus ont varié de {{incomeGrowth}}%. Ce n’est pas celui qui a trop peu, écrit Sénèque, mais celui qui désire davantage qui est pauvre.',
    },
    {
      title: 'Vivre plus haut, non mieux',
      message:
        'Les dépenses ont crû de {{expenseGrowth}}%, les revenus de {{incomeGrowth}}%. Les besoins de la nature sont minces ; les exigences de l’opinion sont sans bornes. Demandez-vous auxquelles sert cette hausse.',
    },
    {
      title: 'Les envies ont grandi : +{{expenseGrowth}}%',
      message:
        'Les dépenses ont grimpé plus vite que les revenus ({{incomeGrowth}}%). Un nouveau confort passe vite pour un besoin : remarquez-le tant que vous pouvez encore le refuser.',
    },
    {
      title: 'Le but recule sans cesse',
      message:
        'Les dépenses sont en hausse de {{expenseGrowth}}% d’un trimestre à l’autre, contre {{incomeGrowth}}% pour les revenus. Assez ne reste assez que si vous décidez vous-même de ce que c’est.',
    },
    {
      title: 'Plus n’est pas le remède',
      message:
        'Sur le dernier trimestre, les dépenses ont crû de {{expenseGrowth}}% et les revenus de {{incomeGrowth}}%. La richesse qui grandit avec le désir n’arrive jamais ; fixez la limite avant que cela ne devienne la nouvelle normalité.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} : {{hours}} heures de votre vie',
      message:
        'Sénèque rappelle que seul le temps nous appartient vraiment. {{totalAmount}} chez {{merchant}}, cela fait environ {{hours}} heures de votre travail. Cela en valait-il la peine ?',
    },
    {
      title: '{{hours}} heures chez {{merchant}}',
      message:
        'Nous gardons notre argent et dilapidons notre temps. À votre revenu horaire moyen, {{totalAmount}} dépensés là représentent à peu près {{hours}} heures de travail.',
    },
    {
      title: 'Comptez en heures',
      message:
        '{{totalAmount}} chez {{merchant}}, c’est environ {{hours}} heures de travail. Les heures sont la seule chose que vous ne pouvez pas regagner.',
    },
    {
      title: 'Ce que {{merchant}} a vraiment coûté',
      message:
        'Vous échangez vos jours contre de l’argent, et l’argent contre des choses. {{merchant}} a pris environ {{hours}} heures des vôtres ({{totalAmount}}). Le plaisir est-il à la hauteur de ces heures ?',
    },
    {
      title: 'Pesez les heures',
      message:
        'Converti à votre revenu horaire moyen, {{totalAmount}} chez {{merchant}} font environ {{hours}} heures. Nous perdons une grande part de notre temps, écrit Sénèque. Était-ce votre choix ?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'La règle « {{rule}} » s’est égarée',
      message:
        'Elle vise quelque chose qui n’existe plus, et a donc cessé de fonctionner sans bruit. Réparez-la ou supprimez-la : un ordre qui ne fait rien n’en a que l’apparence.',
    },
    {
      title: '« {{rule}} » n’agit plus',
      message:
        'Sa catégorie, son compte ou son bénéficiaire a disparu, et la règle est désormais ignorée à chaque transaction. Voyez les choses comme elles sont, puis corrigez-les.',
    },
    {
      title: 'Une règle qui ne vise rien',
      message:
        '« {{rule}} » envoie les transactions vers un endroit supprimé. Vous avez décidé quelque chose autrefois ; décidez de nouveau, maintenant que les choses ont changé.',
    },
    {
      title: '« {{rule}} » attend votre jugement',
      message:
        'Ce à quoi elle renvoie a été supprimé, et les transactions qu’elle classait autrefois vous attendent. Donnez-lui un nouveau but ou laissez-la partir.',
    },
    {
      title: 'Une règle brisée, en silence',
      message:
        '« {{rule}} » ne fait rien et ne dit rien. Réparez ce qui dépend de vous : cela prend une minute.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Votre main contredit « {{rule}} »',
      message:
        'À {{count}} reprises, vous avez classé à la main ce que cette règle classe ailleurs. Soit la règle a tort, soit la main : décidez laquelle.',
    },
    {
      title: '« {{rule}} » a été écartée {{count}} fois',
      message:
        'Une règle que l’on corrige sans cesse n’est plus une décision, seulement une habitude de se disputer avec soi-même. Changez-la ou faites-lui confiance.',
    },
    {
      title: 'Dites ce que vous faites, faites ce que vous dites',
      message:
        'La règle « {{rule}} » dit une chose ; vos {{count}} dernières corrections en disent une autre. Mettez les deux d’accord.',
    },
    {
      title: 'Une décision contestée',
      message:
        'Vous avez fixé « {{rule}} » l’esprit clair, et {{count}} transactions ont depuis pris une autre voie. Regardez de nouveau, calmement, lequel de vous deux avait raison.',
    },
    {
      title: '{{count}} corrections contre « {{rule}} »',
      message:
        'La répétition est une information. Laissez-la changer la règle, ou laissez la règle changer l’habitude.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Décidez une fois pour {{payee}}',
      message:
        'Vous avez classé {{payee}} à la main {{decided}} fois, toujours de la même façon. Ce que l’on décide sans cesse, décidez-le une fois, l’esprit clair.',
    },
    {
      title: 'Une décision prise {{decided}} fois',
      message:
        '{{payee}} pose toujours la même question et vous donnez toujours la même réponse. Une règle réserverait votre attention à ce qui la demande vraiment.',
    },
    {
      title: 'Bénéficiaires prêts pour une règle : {{count}}',
      message:
        'Les mêmes bénéficiaires reçoivent toujours la même catégorie de votre part, {{payee}} plus que tout autre. Gardez votre jugement pour ce qui est nouveau.',
    },
    {
      title: 'Votre habitude est prête à devenir un principe',
      message:
        'Vous classez {{payee}} de la même manière chaque fois ({{decided}} jusqu’ici). Écrivez-le comme une règle et cela tiendra sans effort.',
    },
    {
      title: 'Laissez une règle porter cela',
      message:
        'Bénéficiaires que vous classez toujours de la même manière : {{count}}, dont {{payee}} avec {{decided}} transactions. Un principe fixé une fois n’a pas à être rediscuté.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '« {{rule}} » n’a rien rencontré depuis {{months}} mois',
      message:
        'Soit le monde pour lequel elle a été faite a disparu, soit ses conditions manquent la cible. Gardez vos règles justes : corrigez-la ou supprimez-la.',
    },
    {
      title: 'Une règle au repos : « {{rule}} »',
      message:
        'Elle n’a touché aucune transaction depuis {{months}} mois. Écartez le superflu ; ce qui reste sera plus facile à croire.',
    },
    {
      title: '« {{rule}} » reste inactive',
      message:
        '{{months}} mois sans correspondance alors que de nouvelles transactions continuent d’arriver. Essayez-la sur vos transactions récentes, puis décidez.',
    },
    {
      title: '« {{rule}} » est-elle encore utile ?',
      message:
        'Rien ne lui correspond depuis {{months}} mois. Une règle gardée par habitude est une chose de plus dont il faut s’occuper.',
    },
    {
      title: 'Une décision sans rien à décider',
      message:
        '« {{rule}} » se tait depuis {{months}} mois. L’ordre, c’est avoir ce dont on a besoin, et rien de plus.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Vos décisions tiennent',
      message:
        'Les règles ont classé {{percent}}% des transactions du mois, et vous n’avez pas eu à les contredire. Une décision prise une fois et tenue libère l’esprit.',
    },
    {
      title: '{{percent}}% réglés d’avance',
      message:
        'La plupart des transactions du mois ont été classées selon ce que vous aviez décidé plus tôt. C’est de l’attention épargnée pour ce qui compte.',
    },
    {
      title: 'Des principes à l’œuvre',
      message:
        'Vos règles ont traité {{percent}}% des transactions sans contestation. Des principes établis font des jours tranquilles.',
    },
    {
      title: 'Moins à décider',
      message:
        '{{percent}}% des transactions n’ont demandé aucune décision nouvelle. Vous avez jugé une fois, bien, et ce jugement tient toujours.',
    },
    {
      title: 'L’ordre est gardé',
      message:
        'Les règles ont classé {{percent}}% du mois, et aucune n’a été contredite. Le bon ordre ressemble à l’absence d’événement.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '« {{goal}} » n’a pas de date',
      message:
        'Il en est à {{percent}}%, sans rien qui y entre. Quand on ne sait pas vers quel port on navigue, aucun vent n’est le bon : fixez le jour où vous voulez arriver.',
    },
    {
      title: 'Un souhait, ou un objectif ?',
      message:
        '« {{goal}} » n’a ni échéance ni rythme. Un objectif est une décision avec une date ; donnez-lui-en une, ou laissez-le partir.',
    },
    {
      title: 'Fixez le jour pour « {{goal}} »',
      message:
        'Il est à {{percent}}% du chemin et ne bouge pas. Ce qui peut se faire à tout moment se fait rarement.',
    },
    {
      title: '« {{goal}} » attend un « un jour »',
      message:
        'Rien n’y est entré récemment, et aucune date n’exige quoi que ce soit. « Un jour » n’est pas dans votre calendrier ; choisissez un jour qui y est.',
    },
    {
      title: '« {{goal}} » n’a pas de port',
      message: 'À {{percent}}%, sans échéance. Sachez où vous naviguez, et le pas mensuel suivra.',
    },
  ],
};
