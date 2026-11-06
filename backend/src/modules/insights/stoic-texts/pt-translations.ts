import type { StoicTextMap } from './types';

export const pt: StoicTextMap = {
  'stoic.total_over_plan': [
    {
      title: 'O mês ficou maior que o plano',
      message:
        'Você planejou {{plannedAmount}} e já gastou {{spentAmount}} — {{percent}}% a mais. O plano foi feito com a cabeça fria; deixe que ele fale mais alto que o momento.',
    },
    {
      title: '{{percent}}% além do que você pretendia gastar',
      message:
        'Os gastos estão em {{spentAmount}}, para um plano de {{plannedAmount}}. Veja qual limite cedeu primeiro — é ali que está a lição.',
    },
    {
      title: 'Seu plano e seu mês discordam',
      message:
        '{{spentAmount}} gastos, {{plannedAmount}} pretendidos. Ou o plano pediu pouco demais à realidade, ou a realidade pediu demais a você — decida qual, com calma.',
    },
    {
      title: 'Saiu mais do que você permitiu',
      message:
        'O mês está {{percent}}% acima dos {{plannedAmount}} que você definiu. Nada se perde parando agora; muito se perde fingindo que não aconteceu.',
    },
    {
      title: 'Um limite que você pôs, um limite que você cruzou',
      message:
        'Você queria gastar {{plannedAmount}}; foram {{spentAmount}}. Domínio de si não é nunca tropeçar — é perceber cedo e voltar ao caminho.',
    },
  ],
  'stoic.leisure_over_plan': [
    {
      title: 'O lazer leva mais do que o planejado',
      message:
        'Você queria que o lazer fosse {{planned}}% dos seus gastos; chegou a {{actual}}%. O prazer é bem-vindo como hóspede, não como dono da casa.',
    },
    {
      title: 'Lazer em {{actual}}%, planejado {{planned}}%',
      message:
        'O descanso merece seu lugar quando restaura você. Pergunte quais dos prazeres do mês fizeram isso, e deixe o resto ir sem pesar.',
    },
    {
      title: 'O conforto está gastando mais que a intenção',
      message:
        'O lazer ocupa {{actual}}% dos gastos, contra os {{planned}}% que você escolheu. Moderação não é recusar o prazer — é mantê-lo do tamanho que você decidiu.',
    },
    {
      title: 'O agradável empurra o planejado',
      message:
        'Você deu ao lazer {{planned}}% do plano e ele levou {{actual}}%. O que se desfruta com facilidade merece um segundo olhar antes de virar necessidade.',
    },
    {
      title: 'O lazer passou da sua linha',
      message:
        '{{actual}}% do mês foram para o lazer; a intenção era {{planned}}%. A linha foi você quem traçou, e mantê-la também está nas suas mãos.',
    },
  ],
  'stoic.leisure_habit': [
    {
      title: 'O lazer passou do plano de novo',
      message:
        'O lazer passou do seu plano em {{months}} dos últimos {{window}} meses. A repetição já não é acaso — é um hábito que vale examinar.',
    },
    {
      title: '{{months}} de {{window}} meses acima do plano de lazer',
      message:
        'O que acontece uma vez é circunstância; o que acontece {{months}} vezes é caráter em formação. Escolha esse caráter de propósito.',
    },
    {
      title: 'O mesmo deslize, mês após mês',
      message:
        'O lazer estourou o plano em {{months}} de {{window}} meses. Ou você aumenta o plano com honestidade, ou muda o hábito — viver entre os dois é o que mais custa.',
    },
    {
      title: 'Um padrão, não um lapso',
      message:
        'Em {{months}} dos últimos {{window}} meses o lazer levou mais do que você lhe deu. Repare no momento em que a decisão é tomada, não só na conta depois.',
    },
    {
      title: 'O hábito está votando contra seu plano',
      message:
        'O lazer venceu o plano {{months}} vezes em {{window}} meses. Hábitos se constroem uma escolha de cada vez; e é assim também que se desfazem.',
    },
  ],
  'stoic.virtue_under_plan': [
    {
      title: 'A virtude recebe menos do que o pretendido',
      message:
        'Você reservou {{planned}}% do orçamento para saúde, estudo e outros fins; chegou a {{actual}}%. Uma intenção só conta quando é cumprida.',
    },
    {
      title: 'Virtude em {{actual}}% de {{planned}}% planejados',
      message:
        'O dinheiro que você destinou ao que o torna melhor continua esperando. Não há momento melhor que agora para gastá-lo bem.',
    },
    {
      title: 'O bem que você planejou ainda não foi gasto',
      message:
        'Saúde, aprendizado e generosidade iam receber {{planned}}% dos gastos; receberam {{actual}}%. Faça uma dessas coisas esta semana, de propósito.',
    },
    {
      title: 'Intenção sem ação',
      message:
        'A virtude ocupa {{actual}}% dos gastos, contra os {{planned}}% que você escolheu. O que valorizamos aparece naquilo que de fato pagamos.',
    },
    {
      title: 'Ainda há espaço para o que importa',
      message:
        'Só {{actual}}% foram para a virtude, embora você tenha planejado {{planned}}%. Um livro, um check-up, um presente para quem precisa — o plano já disse sim.',
    },
  ],
  'stoic.virtue_neglected': [
    {
      title: 'A virtude segue sendo adiada',
      message:
        'Os gastos com saúde, aprendizado e os outros estão abaixo do seu plano há {{months}} meses seguidos. O que você adia sempre, na prática já recusou.',
    },
    {
      title: '{{months}} meses de virtude adiada',
      message:
        'Todo mês o plano abriu espaço para o que torna você melhor, e todo mês esse espaço ficou vazio. O tempo é a única coisa que não se orça duas vezes.',
    },
    {
      title: 'Sua melhor versão ainda está esperando',
      message:
        'A virtude está abaixo do plano há {{months}} meses. Comece pequeno e certo, em vez de grande e depois.',
    },
    {
      title: 'As boas intenções estão envelhecendo',
      message:
        'Há {{months}} meses saúde, aprendizado e generosidade recebem menos do que o planejado. Escolha uma e pague por ela primeiro no mês que vem, antes de qualquer outra coisa.',
    },
    {
      title: 'A virtude segue perdendo para o “depois”',
      message:
        '{{months}} meses seguidos abaixo do plano. “Depois” é onde as boas intenções vão para ser esquecidas — dê uma data a esta.',
    },
  ],
  'stoic.virtue_absent_plan': [
    {
      title: 'Seu plano não tem espaço para a virtude',
      message:
        'Nenhum dos seus orçamentos serve à saúde, ao aprendizado ou aos outros. Um plano mostra o que valorizamos — considere dar à virtude uma linha própria.',
    },
    {
      title: 'Orçamento para tudo, menos para o bem',
      message:
        'Necessidade, trabalho e lazer têm limites; a virtude não tem nenhum. O que nunca é planejado tende a nunca acontecer.',
    },
    {
      title: 'Planeje para o que torna você melhor',
      message:
        'Ainda não há orçamento na classe virtude. Mesmo um pequeno — livros, esporte, uma doação — transforma um desejo em compromisso.',
    },
    {
      title: 'O plano se cala sobre a virtude',
      message:
        'Você orça o que precisa e o que aprecia, mas ainda não quem você quer se tornar. Um modesto orçamento de virtude mudaria isso.',
    },
    {
      title: 'A virtude não tem orçamento',
      message:
        'Gastos com saúde, aprendizado ou os outros não estão planejados em lugar nenhum. Escolha um e dê a ele um limite que você ficaria feliz em alcançar.',
    },
  ],
  'stoic.necessity_over_plan': [
    {
      title: 'A necessidade custa mais do que o planejado',
      message:
        'Você planejou {{planned}}% dos gastos para necessidade; ela leva {{actual}}%. Verifique se cada item ainda é uma necessidade ou virou, em silêncio, um conforto.',
    },
    {
      title: 'Necessidade em {{actual}}%, planejado {{planned}}%',
      message:
        'O que a vida exige costuma ser menos do que aquilo a que nos acostumamos. Olhe com olhos novos para o seu maior gasto de necessidade.',
    },
    {
      title: 'O essencial está inchando',
      message:
        'A necessidade ocupa {{actual}}% do mês, contra os {{planned}}% que você esperava. Uma necessidade que não para de crescer merece uma pergunta.',
    },
    {
      title: 'As necessidades estão passando do plano',
      message:
        'Planejado {{planned}}%, real {{actual}}%. Ou o plano subestimou os custos reais, ou alguns desejos estão viajando com nome de necessidade.',
    },
    {
      title: 'Mais gasto com o “tem que” do que o pretendido',
      message:
        'A necessidade levou {{actual}}% dos gastos em vez de {{planned}}%. Separe o que realmente precisa ser do que apenas sempre foi.',
    },
  ],
  'stoic.necessity_creep': [
    {
      title: 'A necessidade sobe aos poucos',
      message:
        'Os gastos com necessidade subiram {{months}} meses seguidos, {{percent}}% no total. As necessidades crescem em silêncio quando ninguém pede que se justifiquem.',
    },
    {
      title: '+{{percent}}% em necessidade em {{months}} meses',
      message:
        'Cada passo parecia pequeno; juntos, não são. Pegue o maior gasto necessário recorrente e pergunte se ele ainda precisa custar tanto.',
    },
    {
      title: 'O piso dos seus gastos está subindo',
      message:
        'A necessidade cresceu {{months}} meses consecutivos (+{{percent}}%). Um piso que sobe deixa menos espaço para tudo o que você escolhe livremente.',
    },
    {
      title: 'As necessidades estão se expandindo',
      message:
        '{{months}} meses de alta, {{percent}}% no total. O teste estoico é simples: você escolheria isso de novo hoje, sabendo o preço?',
    },
    {
      title: 'Pequenos aumentos, direção firme',
      message:
        'A necessidade subiu {{percent}}% em {{months}} meses. A direção importa mais do que qualquer mês isolado — esta vale a pena corrigir cedo.',
    },
  ],
  'stoic.work_over_plan': [
    {
      title: 'O trabalho custa mais do que o planejado',
      message:
        'Você planejou {{planned}}% dos gastos para trabalho; ele leva {{actual}}%. Ferramentas e serviços devem se pagar — verifique quais se pagam.',
    },
    {
      title: 'Gastos de trabalho em {{actual}}%, planejado {{planned}}%',
      message:
        'Investir no seu trabalho é bom quando traz retorno. Reveja o que você paga e já não usa.',
    },
    {
      title: 'O orçamento de trabalho está esticado',
      message:
        'O trabalho levou {{actual}}% em vez de {{planned}}%. Diligência é fazer bem o trabalho, não comprar todas as ferramentas para ele.',
    },
    {
      title: 'As ferramentas estão passando do plano',
      message:
        'Planejado {{planned}}%, gasto {{actual}}% com trabalho. Pergunte a cada despesa: ela me ajuda a trabalhar, ou só parece progresso?',
    },
    {
      title: 'Os custos de trabalho se desviaram',
      message:
        'O trabalho ocupa {{actual}}% dos gastos, contra {{planned}}% pretendidos. Uma revisão rápida agora poupa uma maior depois.',
    },
  ],
  'stoic.repeated_overrun': [
    {
      title: '«{{category}}» passa do limite de novo',
      message:
        '«{{category}}» estourou o orçamento em {{months}} dos últimos {{window}} meses. Ou o limite está errado, ou o desejo — decida qual.',
    },
    {
      title: '«{{category}}»: acima do orçamento em {{months}} de {{window}} meses',
      message:
        'Um limite sempre ultrapassado não é limite, é só um desejo. Torne-o honesto — aumente-o de propósito ou mantenha-o de propósito.',
    },
    {
      title: 'O mesmo orçamento cede outra vez',
      message:
        '«{{category}}» ultrapassou o limite {{months}} vezes em {{window}} meses. A repetição é informação; use-a.',
    },
    {
      title: '«{{category}}» pede sua atenção',
      message:
        'Acima do orçamento em {{months}} de {{window}} meses. Observe o momento antes da compra — é o único lugar onde o hábito pode mudar.',
    },
    {
      title: 'Um padrão em «{{category}}»',
      message:
        '{{months}} estouros em {{window}} meses. Aquilo que repetimos, nós nos tornamos; decida o que você quer que esta categoria diga sobre você.',
    },
  ],
  'stoic.budget_pace': [
    {
      title: '«{{category}}» acaba por volta do dia {{day}}',
      message:
        'Você gastou {{spentAmount}} de {{limitAmount}}, e neste ritmo o limite termina por volta do dia {{day}}. Desacelerar agora é mais fácil do que parar depois.',
    },
    {
      title: '«{{category}}» está à frente do mês',
      message:
        '{{spentAmount}} já saíram de um limite de {{limitAmount}}. Nesse ritmo ele se esgota por volta do dia {{day}} — o resto do mês ainda é seu para moldar.',
    },
    {
      title: 'Checagem de ritmo: «{{category}}»',
      message:
        'No ritmo atual, o orçamento de {{limitAmount}} dura até por volta do dia {{day}}. A previdência é a forma mais barata de disciplina.',
    },
    {
      title: '«{{category}}» está gastando o futuro',
      message:
        '{{spentAmount}} de {{limitAmount}} gastos; o limite termina perto do dia {{day}}. O que você fizer esta semana decide se isso acontece.',
    },
    {
      title: 'Aviso antecipado para «{{category}}»',
      message:
        'No ritmo atual, o limite de {{limitAmount}} não chega ao fim do mês — acaba por volta do dia {{day}}. Ajuste enquanto custa pouco.',
    },
  ],
  'stoic.budget_unused': [
    {
      title: '«{{category}}» ficou sem uso',
      message:
        'O orçamento de «{{category}}» não teve gastos há {{months}} meses. Ou você o superou, ou é uma intenção que ainda espera — decida qual.',
    },
    {
      title: 'Um orçamento vazio: «{{category}}»',
      message:
        '{{months}} meses sem uma única despesa. Um plano deveria descrever a vida que você leva ou a que está construindo — qual é esta?',
    },
    {
      title: '«{{category}}» está parado',
      message:
        'Nada gasto aqui há {{months}} meses. Se foi contenção, muito bem; se foi descuido, aja.',
    },
    {
      title: 'Planejado, mas não vivido',
      message:
        '«{{category}}» tem limite e nenhum gasto há {{months}} meses. Mantenha o plano verdadeiro: remova-o ou use-o.',
    },
    {
      title: '«{{category}}»: {{months}} meses de silêncio',
      message:
        'Um orçamento que nunca é tocado ainda ocupa um lugar no seu plano. Libere o lugar ou honre a intenção.',
    },
  ],
  'stoic.unbudgeted_share': [
    {
      title: '{{percent}}% dos gastos sem limite',
      message:
        '{{unbudgetedAmount}} do mês foram para categorias que nenhum orçamento vigia. O que você não olhou, não pode julgar.',
    },
    {
      title: 'Boa parte do mês não está planejada',
      message:
        '{{percent}}% dos gastos — {{unbudgetedAmount}} — estão fora de qualquer orçamento. Dê um limite à maior parte disso, e o plano verá mais da sua vida.',
    },
    {
      title: 'Gastos fora do plano',
      message:
        'Os orçamentos cobrem só parte do que você gasta; {{unbudgetedAmount}} ({{percent}}%) ficam sem medida. Estenda o plano para onde o dinheiro realmente vai.',
    },
    {
      title: 'O plano vê só parte do quadro',
      message:
        '{{percent}}% dos gastos do mês não têm orçamento. Ver com clareza vem antes de julgar bem.',
    },
    {
      title: '{{unbudgetedAmount}} gastos sem limite',
      message:
        'Isso é {{percent}}% do mês. Você não precisa restringir — só decidir quanto disso realmente quer.',
    },
  ],
  'stoic.leisure_concentration': [
    {
      title: '«{{category}}» é quase todo o seu lazer',
      message:
        '{{percent}}% dos gastos de lazer foram para “{{category}}”. Aproveite, mas confira se você conseguiria largar.',
    },
    {
      title: 'Um prazer domina',
      message:
        '«{{category}}» leva {{percent}}% de tudo o que você gastou com lazer. Pergunte se ainda traz alegria ou se virou rotina.',
    },
    {
      title: 'O lazer se apoia em «{{category}}»',
      message:
        '{{percent}}% do lazer num só lugar. Aquilo sem o qual não conseguimos viver nos prende — confira se a pegada ainda é leve.',
    },
    {
      title: '«{{category}}»: {{percent}}% do lazer',
      message:
        'Uma única fonte de prazer leva quase tudo. Fique sem ela por um tempo e veja o que ela realmente dá.',
    },
    {
      title: 'Seu descanso tem um só endereço',
      message:
        'A maior parte do dinheiro de lazer, {{percent}}%, vai para “{{category}}”. Você só é livre de um prazer se puder passar sem ele.',
    },
  ],
  'stoic.unclassified': [
    {
      title: 'Parte dos gastos ainda não foi avaliada',
      message:
        'Categorias sem classe: {{count}}. Decida em Orçamentos o que é necessidade, trabalho, virtude ou lazer.',
    },
    {
      title: 'Categorias aguardando seu julgamento: {{count}}',
      message:
        'Elas têm gastos, mas nenhuma classe, então o conselho não consegue pesá-las. Um minuto em Orçamentos resolve.',
    },
    {
      title: 'Dê nome ao que seu dinheiro serve',
      message:
        'Categorias ainda sem classificação: {{count}}. O julgamento começa por chamar as coisas pelo nome certo.',
    },
    {
      title: 'Gastos não avaliados — categorias: {{count}}',
      message:
        'É uma necessidade, seu trabalho, uma virtude ou um prazer? Só você pode dizer — e o plano fica mais claro assim que você diz.',
    },
    {
      title: 'Algumas categorias não têm classe',
      message:
        'Fora das quatro classes: {{count}}. Classifique-as em Orçamentos para que cada despesa seja vista pelo que é.',
    },
  ],
  'stoic.small_purchases': [
    {
      title: 'Pequenas compras em {{merchant}}: {{count}}',
      message:
        'Cada uma parecia insignificante; juntas somaram {{totalAmount}} no mês. É nos pequenos hábitos não examinados que mais dinheiro some em silêncio.',
    },
    {
      title: '{{merchant}}: {{count}} vezes em um mês',
      message:
        '{{totalAmount}} em pequenas quantias. Pergunte se cada visita foi uma escolha ou um reflexo: só a primeira é liberdade.',
    },
    {
      title: 'Pouco a pouco: {{totalAmount}}',
      message:
        'Compras em {{merchant}}: {{count}}. Nenhuma importa sozinha; o hábito, sim. Decida com que frequência você realmente quer isso.',
    },
    {
      title: 'Um hábito em {{merchant}}',
      message:
        '{{count}} compras, {{totalAmount}} no total. Tente pular uma em cada três e veja se sente falta.',
    },
    {
      title: 'As pequenas coisas se somam',
      message:
        '{{merchant}} viu você {{count}} vezes, por {{totalAmount}}. O domínio sobre as grandes decisões se constrói com pequenas como estas.',
    },
  ],
  'stoic.weekend_leisure': [
    {
      title: 'Os fins de semana carregam {{percent}}% do lazer',
      message:
        'A maior parte dos seus gastos com lazer acontece aos sábados e domingos. Descanso é bom; confira se é descanso e não compensação pela semana.',
    },
    {
      title: 'O lazer mora no fim de semana',
      message:
        '{{percent}}% dos gastos com lazer caem no fim de semana. Planeje um pouco o fim de semana, e ele custará menos e dará mais.',
    },
    {
      title: 'O fim de semana paga pela semana',
      message:
        'Os fins de semana levam {{percent}}% do que você gasta com lazer. Se a semana precisa de conserto todo sábado, olhe para a semana.',
    },
    {
      title: 'Sábado e domingo: {{percent}}% do lazer',
      message:
        'Dias livres convidam a gastos livres. Decida antes do fim de semana para que ele serve, e deixe o dinheiro seguir.',
    },
    {
      title: 'Um padrão de fim de semana',
      message:
        '{{percent}}% dos gastos com lazer acontecem no fim de semana. Mais leveza durante a semana costuma deixar os fins de semana mais baratos.',
    },
  ],
  'stoic.top_merchant': [
    {
      title: '{{merchant}} levou {{percent}}% do mês',
      message:
        '{{totalAmount}} foram para um único estabelecimento de lazer. Quando um lugar tem tanto do seu dinheiro, pergunte quanto ele também tem da sua atenção.',
    },
    {
      title: 'Um só lugar, {{totalAmount}}',
      message:
        '{{merchant}} representa {{percent}}% dos gastos do mês. Vale essa parte do trabalho da sua vida?',
    },
    {
      title: '{{merchant}} lidera seus gastos',
      message:
        '{{percent}}% do mês — {{totalAmount}} — foram para lá. Nada de errado em aproveitar, desde que você escolhesse de novo.',
    },
    {
      title: 'Uma fatia grande em {{merchant}}',
      message:
        '{{totalAmount}}, ou {{percent}}% dos gastos, num só lugar de lazer. Pese o prazer contra o preço, com calma.',
    },
    {
      title: '{{percent}}% em {{merchant}}',
      message:
        'Este único estabelecimento levou {{totalAmount}}. Liberdade é poder passar direto quando você quiser.',
    },
  ],
  'stoic.income_drop': [
    {
      title: 'A renda caiu, os gastos não',
      message:
        'A renda caiu {{percent}}%, para {{incomeAmount}}, mas os gastos ficaram em {{expenseAmount}}. A fortuna mudou de ideia; seus gastos ainda não perceberam.',
    },
    {
      title: 'Renda {{percent}}% menor',
      message:
        'Entraram {{incomeAmount}} e saíram {{expenseAmount}}. O que a fortuna dá, ela pode tomar de volta — ajuste os gastos ao que é, não ao que era.',
    },
    {
      title: 'Um mês mais magro, os mesmos hábitos',
      message:
        'A renda está {{percent}}% menor ({{incomeAmount}}), enquanto os gastos se mantiveram em {{expenseAmount}}. A renda não está em seu poder; a resposta, sim.',
    },
    {
      title: 'A fortuna mudou',
      message:
        'Você ganhou {{percent}}% menos do que o normal, mas gastou {{expenseAmount}} como antes. Corte agora, enquanto é uma escolha e não uma necessidade.',
    },
    {
      title: 'Os gastos não acompanharam a renda',
      message:
        'A renda caiu para {{incomeAmount}} ({{percent}}% a menos); os gastos estão em {{expenseAmount}}. Ajuste a vela ao vento que você realmente tem.',
    },
  ],
  'stoic.subscriptions_share': [
    {
      title: 'Assinaturas: {{monthlyAmount}} por mês',
      message:
        'Assinaturas ({{count}}) levam {{percent}}% dos seus gastos mensais. Cada uma se renova sem perguntar a você — pergunte você sobre cada uma.',
    },
    {
      title: '{{percent}}% dos gastos se renovam sozinhos',
      message:
        'Assinaturas: {{count}}, {{monthlyAmount}} por mês. Fique com as que você assinaria de novo hoje.',
    },
    {
      title: 'Silencioso, recorrente, {{monthlyAmount}}',
      message:
        'Assinaturas ({{count}}) custam {{percent}}% do seu mês. A conveniência é boa serva e senhora cara.',
    },
    {
      title: 'Assinaturas para revisar: {{count}}',
      message:
        'Juntas, somam {{monthlyAmount}} por mês, {{percent}}% dos gastos. Cancele uma que você mal usa e perceba como pouco sente falta.',
    },
    {
      title: 'O que se renova sozinho',
      message:
        '{{monthlyAmount}} por mês entre suas assinaturas ({{count}}). Gasto automático merece uma revisão deliberada.',
    },
  ],
  'stoic.generosity_gap': [
    {
      title: 'Seu sucesso poderia ir um pouco mais longe',
      message:
        'Em {{months}} meses você guardou {{savingsPercent}}% da sua renda, mas quase nada foi para os outros. A riqueza fica melhor em mãos abertas — talvez um presente ou uma doação este mês?',
    },
    {
      title: 'Ganha bem, doa pouco',
      message:
        'Em {{months}} meses entraram {{incomeAmount}} e {{givenAmount}} foram para outras pessoas. Se você ajuda de formas que este app não vê, ignore isto; se não, seu plano tem espaço para isso.',
    },
    {
      title: 'Um bom momento para a generosidade',
      message:
        'Você poupou {{savingsPercent}}% da renda — sinal de mão firme. Uma pequena parte disso, dada a quem precisa, faria essa firmeza significar mais.',
    },
    {
      title: 'Ainda não há mais ninguém no quadro',
      message:
        'Os últimos {{months}} meses mostram ganhos e poupança cuidadosos, mas nenhuma doação ou presente. Fomos feitos uns para os outros; um presente modesto basta para começar.',
    },
    {
      title: 'Espaço para a bondade',
      message:
        'Apenas {{givenAmount}} de {{incomeAmount}} foi para ajudar os outros. Pense em uma doação pequena e regular — a generosidade, como toda virtude, fica mais fácil com o hábito.',
    },
  ],
  'stoic.goal_behind': [
    {
      title: '«{{goal}}» está ficando para trás',
      message:
        'Ela precisa de {{requiredAmount}} por mês, e você está colocando cerca de {{paceAmount}}. Nesse ritmo, chega com {{monthsLate}} meses de atraso. O ritmo está ao seu alcance.',
    },
    {
      title: '«{{goal}}»: meses de atraso neste ritmo: {{monthsLate}}',
      message:
        'Necessário {{requiredAmount}} por mês, real cerca de {{paceAmount}}. Mova a data com honestidade ou mova mais dinheiro de propósito.',
    },
    {
      title: 'A meta e o ritmo discordam',
      message:
        '«{{goal}}» pede {{requiredAmount}} por mês; recebe {{paceAmount}}. Uma meta só é tão real quanto o passo mensal em direção a ela.',
    },
    {
      title: '«{{goal}}» precisa de um passo mais firme',
      message:
        '{{paceAmount}} por mês contra os {{requiredAmount}} necessários. No mês que vem, pague a meta primeiro, antes de qualquer coisa opcional.',
    },
    {
      title: 'Atrasado em «{{goal}}»',
      message:
        'O ritmo atual ({{paceAmount}}/mês) a deixa com {{monthsLate}} meses de atraso. O que está ao seu alcance é o próximo passo, não o caminho inteiro.',
    },
  ],
  'stoic.goal_not_feasible': [
    {
      title: '«{{goal}}» não cabe no plano',
      message:
        'Precisa de {{requiredAmount}} por mês, mas depois dos seus orçamentos só sobram {{freeAmount}}. Mude a data, o alvo ou os orçamentos — ter esperança não é um plano.',
    },
    {
      title: '«{{goal}}» pede mais do que você tem livre',
      message:
        '{{requiredAmount}} necessários por mês, {{freeAmount}} disponíveis. Querer tudo de uma vez é o jeito de não fazer nada; escolha.',
    },
    {
      title: 'Os números dizem não — por enquanto',
      message:
        '«{{goal}}» precisa de {{requiredAmount}} por mês; seu dinheiro livre é {{freeAmount}}. Ajuste o que está em seu poder: o prazo ou os outros limites.',
    },
    {
      title: '«{{goal}}» precisa de uma decisão',
      message:
        'A {{requiredAmount}} por mês, ela ultrapassa os {{freeAmount}} que sobram depois dos orçamentos. Uma meta escolhida de olhos abertos é melhor do que uma mantida por ilusão.',
    },
    {
      title: 'Um ritmo impossível para «{{goal}}»',
      message:
        'Necessário {{requiredAmount}} por mês, livre {{freeAmount}}. Contas honestas agora poupam decepção depois.',
    },
  ],
  'stoic.shortfall': [
    {
      title: 'Seu saldo fica negativo em {{date}}',
      message:
        'Com a renda e os gastos como estão, o saldo previsto chega a {{lowestAmount}}. Prepare-se agora, enquanto é só uma previsão.',
    },
    {
      title: 'Um aperto se aproxima: {{date}}',
      message:
        'Os pagamentos e os gastos do dia a dia superam o que entra, com o ponto mais baixo em {{lowestAmount}}. Antecipar a dificuldade é o que tira o poder dela.',
    },
    {
      title: 'Planeje-se para {{date}}',
      message:
        'Nesse dia o saldo previsto chega a {{lowestAmount}}. Adiar um pagamento, segurar um desejo ou separar dinheiro — tudo isso está em seu poder hoje.',
    },
    {
      title: 'A previsão cai abaixo de zero',
      message:
        'O saldo cai para {{lowestAmount}} por volta de {{date}}. A resposta serena é a antecipada.',
    },
    {
      title: 'Preveja o buraco de {{date}}',
      message:
        'Menor saldo previsto: {{lowestAmount}}. O que é previsto pode ser enfrentado com serenidade; o que nos surpreende, raramente.',
    },
  ],
  'stoic.praise_within_plan': [
    {
      title: 'Você cumpriu a palavra dada a si mesmo',
      message:
        'Há {{months}} meses seguidos seus gastos ficam dentro do plano que você definiu. É assim que se parece o domínio de si.',
    },
    {
      title: '{{months}} meses dentro do plano',
      message:
        'Mês após mês, o que você pretendia e o que fez concordam. A constância é mais silenciosa que a força de vontade e dura mais.',
    },
    {
      title: 'Plano e vida concordam',
      message:
        '{{months}} meses consecutivos dentro dos seus limites. Um plano cumprido assim já não é restrição — é o seu jeito de viver.',
    },
    {
      title: 'Constante há {{months}} meses',
      message:
        'Seus orçamentos se mantêm há {{months}} meses. Mantenha a mesma atenção; está funcionando.',
    },
    {
      title: 'Disciplina sustentada',
      message:
        '{{months}} meses sem quebrar seu plano. Poucas coisas libertam tanto quanto confiar nas próprias decisões.',
    },
  ],
  'stoic.praise_virtue': [
    {
      title: 'Seu dinheiro segue seus valores',
      message:
        'O dinheiro a serviço da virtude somou {{actual}}% dos seus gastos, não menos que os {{planned}}% planejados. Bem gasto.',
    },
    {
      title: 'A virtude recebeu sua parte inteira',
      message:
        '{{actual}}% em saúde, aprendizado e os outros, contra {{planned}}% planejados. O que você valoriza, você pagou.',
    },
    {
      title: 'Gasto em se tornar melhor',
      message:
        'Saúde, estudo e outros fins receberam {{actual}}% dos gastos do mês (planejado: {{planned}}%). A virtude não se compra, mas pode ser servida.',
    },
    {
      title: 'Intenção cumprida',
      message:
        'Você planejou {{planned}}% para a virtude e gastou {{actual}}%. Boas intenções raramente sobrevivem a um mês — a sua sobreviveu.',
    },
    {
      title: 'O melhor uso do dinheiro',
      message:
        '{{actual}}% foram para o que torna você e os outros melhores. Continue escolhendo isso.',
    },
  ],
  'stoic.praise_leisure_restrained': [
    {
      title: 'O lazer em seu lugar',
      message:
        'O lazer é {{actual}}% dos gastos, abaixo dos {{planned}}% que você lhe permitiu. Você desfruta das coisas sem ser governado por elas.',
    },
    {
      title: 'O prazer, no tamanho certo',
      message:
        'O lazer levou {{actual}}% contra {{planned}}% planejados. Moderação não é ficar de fora — é escolher.',
    },
    {
      title: 'Descanso sem excesso',
      message:
        '{{actual}}% em lazer, abaixo do seu limite de {{planned}}%. O prazer tem melhor sabor quando não é ele quem manda.',
    },
    {
      title: 'Temperança, em silêncio',
      message:
        'Você deu {{planned}}% ao lazer e ele usou só {{actual}}%. Essa margem é liberdade que você guardou.',
    },
    {
      title: 'Lazer abaixo do plano',
      message:
        'Com {{actual}}% dos gastos, o lazer ficou abaixo dos {{planned}}% que você definiu. Bem mantido.',
    },
  ],
  'stoic.praise_under_plan': [
    {
      title: '{{percent}}% abaixo do plano',
      message:
        'Você gastou {{savedAmount}} a menos do que se permitira para o mês. Não precisar de tudo o que poderia ter é uma forma de riqueza.',
    },
    {
      title: '{{savedAmount}} não gastos',
      message:
        'O mês fechou {{percent}}% abaixo do plano. O que você não gastou ainda é seu para direcionar.',
    },
    {
      title: 'Menos do que você se permitiu',
      message:
        'Os gastos estão {{percent}}% abaixo do plano — {{savedAmount}} guardados. Dê um propósito a essa margem antes que o hábito a reivindique.',
    },
    {
      title: 'O plano tinha folga',
      message:
        '{{savedAmount}} abaixo dos seus limites do mês. A moderação que parece fácil é a que dura.',
    },
    {
      title: 'Mais leve que o planejado',
      message:
        'Você precisou de {{percent}}% menos do que orçou. Considere enviar os {{savedAmount}} para uma meta.',
    },
  ],
  'stoic.praise_goal_on_track': [
    {
      title: '«{{goal}}» está no prazo',
      message:
        'Você já percorreu {{percent}}% do caminho, no ritmo de que a meta precisa. Passos firmes, dados todo mês, vão longe.',
    },
    {
      title: 'No rumo de «{{goal}}»',
      message:
        '{{percent}}% concluídos e o ritmo se mantém. Continue pagando a meta primeiro; está funcionando.',
    },
    {
      title: '«{{goal}}»: {{percent}}% e constante',
      message: 'A meta recebe todo mês o que precisa. A paciência está fazendo o seu trabalho.',
    },
    {
      title: 'A meta avança como planejado',
      message:
        '«{{goal}}» está {{percent}}% financiada e no prazo. O que se faz um pouco a cada mês não é detido por uma semana ruim.',
    },
    {
      title: 'Um progresso em que se pode confiar',
      message:
        '«{{goal}}» está em {{percent}}%, no ritmo. Você a está construindo do único jeito que funciona — aos poucos.',
    },
  ],
  'stoic.praise_fewer_small': [
    {
      title: 'Menos compras por impulso em {{merchant}}',
      message:
        'De {{before}} compras em um mês para cerca de {{after}}. Um hábito afrouxado é liberdade conquistada.',
    },
    {
      title: '{{merchant}}: {{before}} → {{after}}',
      message:
        'Você vai lá menos do que antes. Cada reflexo evitado é uma pequena vitória da escolha sobre o hábito.',
    },
    {
      title: 'O pequeno hábito está diminuindo',
      message:
        'As compras em {{merchant}} caíram de {{before}} para cerca de {{after}}. Continue — fica mais fácil.',
    },
    {
      title: 'Escolha acima do reflexo',
      message:
        'Em {{merchant}} você passou de {{before}} compras para cerca de {{after}}. Isso é domínio construído uma decisão por vez.',
    },
    {
      title: 'Menos das pequenas coisas',
      message:
        '{{merchant}} viu você cerca de {{after}} vezes em vez de {{before}}. Pequenas vitórias se acumulam.',
    },
  ],
  'stoic.praise_income_adapted': [
    {
      title: 'Você se adaptou a um mês mais magro',
      message:
        'A renda caiu {{incomePercent}}%, e você cortou os gastos em {{expensePercent}}%. Você respondeu a uma mudança da fortuna com uma mudança de rumo.',
    },
    {
      title: 'Serenidade quando a renda caiu',
      message:
        'Renda {{incomePercent}}% menor, gastos {{expensePercent}}% menores. Você se ajustou ao que é, não ao que era.',
    },
    {
      title: 'A fortuna mudou; você também',
      message:
        'Uma queda de {{incomePercent}}% na renda encontrou uma queda de {{expensePercent}}% nos gastos. Isso é equanimidade em números.',
    },
    {
      title: 'Bem conduzido',
      message:
        'Quando a renda caiu {{incomePercent}}%, os gastos acompanharam ({{expensePercent}}% a menos). O vento não era seu; a vela, sim.',
    },
    {
      title: 'Os gastos acompanharam a renda para baixo',
      message:
        'Você gastou {{expensePercent}}% a menos quando a renda caiu {{incomePercent}}%. Adaptar-se cedo é o caminho tranquilo.',
    },
  ],
  'stoic.praise_necessity_stable': [
    {
      title: 'A necessidade está estável',
      message:
        'Há {{months}} meses seus custos essenciais quase não se mexem. Um piso estável dá liberdade acima dele.',
    },
    {
      title: 'Necessidades sob controle',
      message:
        'Os gastos com necessidade ficaram no mesmo nível por {{months}} meses. Necessidades que não crescem são necessidades que você controla.',
    },
    {
      title: '{{months}} meses de essenciais estáveis',
      message:
        'Aluguel, comida e contas ficaram onde estavam. A estabilidade silenciosa também é uma conquista.',
    },
    {
      title: 'Nada de deriva na necessidade',
      message:
        '{{months}} meses sem desvio naquilo que a vida exige. Sobre esse chão, todo o resto fica mais fácil de planejar.',
    },
    {
      title: 'Um piso firme',
      message:
        'Os gastos essenciais estão estáveis há {{months}} meses. Você não deixa confortos se passarem por necessidades.',
    },
  ],
  'stoic.praise_generosity': [
    {
      title: 'Generosidade com o que você ganha',
      message:
        'Em {{months}} meses, {{percent}}% da sua renda — {{givenAmount}} — foi para ajudar os outros. É dinheiro usado da melhor forma.',
    },
    {
      title: '{{givenAmount}} doados a outros',
      message:
        'Você compartilhou {{percent}}% da sua renda em {{months}} meses. Bondade que aparece nos números é bondade praticada, não só sentida.',
    },
    {
      title: 'Mãos abertas',
      message:
        'Doações e presentes levaram {{percent}}% da sua renda nos últimos tempos. O que você dá é a parte da sua riqueza que nenhum infortúnio pode tirar.',
    },
    {
      title: 'A generosidade faz parte do seu plano',
      message:
        '{{givenAmount}} para outros em {{months}} meses. Mantenha isso — o bem que você faz aos outros também faz a si mesmo.',
    },
    {
      title: 'Bem dado',
      message:
        '{{percent}}% do que você ganhou foi para ajudar os outros. Poucos hábitos dizem mais sobre uma pessoa.',
    },
  ],
  'stoic.praise_steady': [
    {
      title: 'Nada a corrigir',
      message: 'Seus gastos correspondem ao que você pretendia. Continue assim.',
    },
    {
      title: 'Intenção e ação concordam',
      message: 'O mês se parece com o que você planejou. Essa concordância é todo o ponto.',
    },
    {
      title: 'Um mês calmo',
      message:
        'Nenhum excesso, nenhum descuido digno de nota. Muito bem — leve a mesma atenção adiante.',
    },
    {
      title: 'Tudo em ordem',
      message: 'Seu plano se manteve e nada pede correção. Aproveite a calma que você conquistou.',
    },
    {
      title: 'Mão firme',
      message: 'O mês seguiu seu plano. Bons hábitos fazem os bons meses parecerem comuns.',
    },
  ],
  'stoic.keep_first': [
    {
      title: 'Guarde primeiro a sua parte',
      message:
        'Em {{months}} meses você guardou {{savingsPercent}}% da renda. O aviso de Sêneca: é tarde para poupar quando se chega ao fundo do tonel. Separe {{tenthAmount}} no dia em que o dinheiro chegar.',
    },
    {
      title: 'Poupe no alto do tonel',
      message:
        'Só {{savingsPercent}}% da renda ficou com você. A economia que espera pela sobra chega tarde; {{tenthAmount}} por mês, separados primeiro, a começam agora.',
    },
    {
      title: 'O que é seu, guarde',
      message:
        'Sêneca aconselha guardar o que realmente é seu e começar cedo. Ultimamente ficaram com você {{savingsPercent}}% da renda; comece com {{tenthAmount}} no dia do pagamento e deixe os gastos se ajustarem ao resto.',
    },
    {
      title: 'Comece antes da borra',
      message:
        'Você guardou {{savingsPercent}}% em {{months}} meses. Poupar só depende de você enquanto ainda há algo a poupar: separe {{tenthAmount}} antes de qualquer outra coisa.',
    },
    {
      title: '{{savingsPercent}}% guardados, e o tonel está esvaziando',
      message:
        '{{tenthAmount}} por mês, um décimo da renda, separados antes de qualquer conta. O que você guarda primeiro não depende do que o mês deixa.',
    },
  ],
  'stoic.prepare_beforehand': [
    {
      title: 'Prepare-se enquanto há calma',
      message:
        'Sua reserva cobre cerca de {{cushionDays}} dias de gastos. Sêneca: a alma deve se endurecer nos tempos livres de preocupação. Três meses de gastos são {{targetAmount}}.',
    },
    {
      title: 'Uma reserva de {{cushionDays}} dias',
      message:
        'A fortuna não se anuncia. Busque {{targetAmount}}, três meses de gastos, enquanto nada pressiona: é quando é fácil.',
    },
    {
      title: '“É esta a condição que eu temia?”',
      message:
        'Sêneca fazia Lucílio ensaiar a pobreza para que ela perdesse o terror. Com {{cushionDays}} dias de reserva, um mês difícil não seria ensaio. Mire em {{targetAmount}}.',
    },
    {
      title: 'Preveja o mês difícil',
      message:
        'Suas economias durariam cerca de {{cushionDays}} dias. O que se prevê chega com suavidade; {{targetAmount}} sustentariam você por três meses.',
    },
    {
      title: 'Levante o muro antes da tempestade',
      message:
        'Cerca de {{cushionDays}} dias estão cobertos. Perder a renda não depende de você; a reserva, sim. Três meses de gastos somam {{targetAmount}}.',
    },
  ],
  'stoic.wants_outrun_income': [
    {
      title: 'Os desejos estão ultrapassando a renda',
      message:
        'Os gastos subiram {{expenseGrowth}}% no último trimestre, enquanto a renda variou {{incomeGrowth}}%. Pobre não é quem tem pouco demais, escreve Sêneca, mas quem deseja mais.',
    },
    {
      title: 'Viver mais alto, não melhor',
      message:
        'Os gastos cresceram {{expenseGrowth}}%, a renda {{incomeGrowth}}%. As necessidades da natureza são pequenas; as exigências da opinião não têm limite. Pergunte a quais delas o aumento serve.',
    },
    {
      title: 'Os desejos cresceram: +{{expenseGrowth}}%',
      message:
        'As despesas subiram mais depressa que a renda ({{incomeGrowth}}%). Um conforto novo logo parece necessidade: perceba isso enquanto ainda pode recusá-lo.',
    },
    {
      title: 'A meta está mudando de lugar',
      message:
        'Os gastos subiram {{expenseGrowth}}% de um trimestre para outro, contra {{incomeGrowth}}% da renda. O bastante só continua bastando se você decidir o que ele é.',
    },
    {
      title: 'Mais não é o remédio',
      message:
        'No último trimestre os gastos cresceram {{expenseGrowth}}% e a renda {{incomeGrowth}}%. A riqueza que cresce com o desejo nunca chega; defina o limite antes que isso vire o novo normal.',
    },
  ],
  'stoic.price_in_life': [
    {
      title: '{{merchant}} custou {{hours}} horas da sua vida',
      message:
        'Sêneca lembra que só o tempo é verdadeiramente nosso. {{totalAmount}} em {{merchant}} são cerca de {{hours}} horas do seu trabalho. Valeu a pena?',
    },
    {
      title: '{{hours}} horas em {{merchant}}',
      message:
        'Guardamos o dinheiro e damos o tempo de graça. Pela sua renda média por hora, {{totalAmount}} gastos ali são mais ou menos {{hours}} horas de trabalho.',
    },
    {
      title: 'Dê preço em horas',
      message:
        '{{totalAmount}} em {{merchant}} são cerca de {{hours}} horas de trabalho. As horas são a única coisa que você não recupera.',
    },
    {
      title: 'O que {{merchant}} realmente custou',
      message:
        'Você troca seus dias por dinheiro, e o dinheiro por coisas. {{merchant}} levou cerca de {{hours}} horas suas ({{totalAmount}}). O prazer está à altura dessas horas?',
    },
    {
      title: 'Pese as horas',
      message:
        'Convertidos pela sua renda média por hora, {{totalAmount}} em {{merchant}} são cerca de {{hours}} horas. Perdemos grande parte do nosso tempo, escreve Sêneca. Foi uma escolha sua?',
    },
  ],
  'stoic.rule_broken': [
    {
      title: 'A regra “{{rule}}” perdeu o rumo',
      message:
        'Ela aponta para algo que já não existe e, por isso, deixou de funcionar em silêncio. Conserte-a ou remova-a: uma ordem que nada faz só parece ordem.',
    },
    {
      title: '“{{rule}}” já não age',
      message:
        'A categoria, a conta ou o beneficiário dela sumiu, e agora a regra é ignorada em cada transação. Veja as coisas como são e depois corrija-as.',
    },
    {
      title: 'Uma regra sem alvo',
      message:
        '“{{rule}}” manda as transações para um lugar que foi removido. Você decidiu algo uma vez; decida de novo, agora que as coisas mudaram.',
    },
    {
      title: '“{{rule}}” precisa do seu juízo',
      message:
        'O que ela cita foi excluído, e as transações que antes classificava agora esperam por você. Dê a ela um novo alvo ou deixe-a ir.',
    },
    {
      title: 'Uma regra quebrada, em silêncio',
      message:
        '“{{rule}}” não faz nada e não diz nada. Conserte o que está ao seu alcance: leva um minuto.',
    },
  ],
  'stoic.rule_contradicted': [
    {
      title: 'Sua mão discorda de “{{rule}}”',
      message:
        '{{count}} vezes você classificou à mão o que esta regra classifica em outro lugar. Ou a regra está errada ou a mão está: decida qual.',
    },
    {
      title: '“{{rule}}” foi desfeita {{count}} vezes',
      message:
        'Uma regra que você vive corrigindo já não é uma decisão, apenas o hábito de discutir consigo mesmo. Mude-a ou confie nela.',
    },
    {
      title: 'Diga o que faz, faça o que disse',
      message:
        'A regra “{{rule}}” diz uma coisa; suas últimas {{count}} correções dizem outra. Ponha as duas em acordo.',
    },
    {
      title: 'Uma decisão em disputa',
      message:
        'Você criou “{{rule}}” de cabeça fria, e desde então {{count}} transações tomaram outro rumo. Veja de novo, com calma, quem tinha razão.',
    },
    {
      title: '{{count}} correções contra “{{rule}}”',
      message:
        'A repetição é informação. Deixe que ela mude a regra, ou deixe a regra mudar o hábito.',
    },
  ],
  'stoic.rule_worth_writing': [
    {
      title: 'Decida uma vez sobre {{payee}}',
      message:
        'Você classificou {{payee}} à mão {{decided}} vezes, sempre do mesmo jeito. O que você decide sem parar, decida uma vez, de cabeça fria.',
    },
    {
      title: 'Uma decisão tomada {{decided}} vezes',
      message:
        '{{payee}} faz sempre a mesma pergunta e você dá sempre a mesma resposta. Uma regra guardaria sua atenção para o que realmente a pede.',
    },
    {
      title: 'Beneficiários prontos para uma regra: {{count}}',
      message:
        'Os mesmos beneficiários recebem de você sempre a mesma categoria, {{payee}} mais que todos. Poupe seu juízo para o que é novo.',
    },
    {
      title: 'Seu hábito está pronto para virar princípio',
      message:
        'Você classifica {{payee}} sempre do mesmo modo ({{decided}} até agora). Escreva isso como regra e ela se sustentará sem esforço.',
    },
    {
      title: 'Deixe uma regra carregar isto',
      message:
        'Beneficiários que você classifica sempre igual: {{count}}, com {{payee}} à frente, com {{decided}} transações. Um princípio fixado uma vez não precisa ser rediscutido.',
    },
  ],
  'stoic.rule_idle': [
    {
      title: '“{{rule}}” não encontrou nada em {{months}} meses',
      message:
        'Ou o mundo para o qual foi feita acabou, ou as condições dela erram o alvo. Mantenha suas regras verdadeiras: corrija-a ou remova-a.',
    },
    {
      title: 'Uma regra em repouso: “{{rule}}”',
      message:
        'Ela não tocou em nenhuma transação há {{months}} meses. Lance fora o supérfluo; o que restar será mais fácil de confiar.',
    },
    {
      title: '“{{rule}}” está parada',
      message:
        '{{months}} meses sem nenhuma correspondência, enquanto novas transações continuam chegando. Teste-a nas recentes e depois decida.',
    },
    {
      title: '“{{rule}}” ainda é necessária?',
      message:
        'Nada corresponde a ela há {{months}} meses. Uma regra mantida por hábito é mais uma coisa para cuidar.',
    },
    {
      title: 'Uma decisão sem nada a decidir',
      message:
        '“{{rule}}” está calada há {{months}} meses. Ordem é ter o que se precisa, e só isso.',
    },
  ],
  'stoic.praise_rules_hold': [
    {
      title: 'Suas decisões se sustentam',
      message:
        'As regras classificaram {{percent}}% das transações do mês, e você não precisou desfazer nenhuma. Uma decisão tomada uma vez e mantida liberta a mente.',
    },
    {
      title: '{{percent}}% resolvidos de antemão',
      message:
        'A maior parte das transações do mês foi classificada pelo que você decidira antes. É atenção poupada para o que importa.',
    },
    {
      title: 'Princípios em ação',
      message:
        'Suas regras trataram {{percent}}% das transações sem disputa. Princípios assentados trazem dias tranquilos.',
    },
    {
      title: 'Menos a decidir',
      message:
        '{{percent}}% das transações não precisaram de uma decisão nova. Você julgou uma vez, bem, e o juízo continua de pé.',
    },
    {
      title: 'Ordem mantida',
      message:
        'As regras classificaram {{percent}}% do mês e nenhuma foi contrariada. A boa ordem tem a aparência de nada acontecendo.',
    },
  ],
  'stoic.goal_no_date': [
    {
      title: '“{{goal}}” não tem data',
      message:
        'Está em {{percent}}%, sem nada entrando. Quando não se sabe para que porto se navega, nenhum vento serve: diga o dia em que pretende chegar.',
    },
    {
      title: 'Um desejo ou uma meta?',
      message:
        '“{{goal}}” não tem prazo nem ritmo. Meta é uma decisão com data; dê uma a ela ou deixe-a ir.',
    },
    {
      title: 'Dê um dia a “{{goal}}”',
      message:
        'Está a {{percent}}% do caminho e parada. O que pode ser feito a qualquer momento raramente é feito.',
    },
    {
      title: '“{{goal}}” espera um “algum dia”',
      message:
        'Nada entrou nela ultimamente, e nenhuma data exige coisa alguma. “Algum dia” não está no seu calendário; escolha um dia que esteja.',
    },
    {
      title: '“{{goal}}” não tem porto',
      message:
        'Em {{percent}}%, sem prazo. Saiba para onde navega, e o passo mensal vem em seguida.',
    },
  ],
};
