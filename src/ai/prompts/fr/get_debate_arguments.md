Sur le sujet "{{current_subject}}", voici une proposition d'action pouvant être entreprise par les élus du territoire "{{territory_name}}" ({{territory_type}}):
{{proposition_text}}

Pour cette proposition, écris:

- trois textes de 80 mots maximum qui sont les trois meilleurs arguments en faveur de la proposition, avec un vocabulaire simple, en ajoutant des liens vers Wikipédia pour les notions les plus compliquées, ainsi qu'un titre de 40 caractères maximum (espaces compris)
- trois textes de 80 mots maximum qui sont les trois meilleurs arguments en défaveur de la proposition, avec un vocabulaire simple, en ajoutant des liens vers Wikipédia pour les notions les plus compliquées, ainsi qu'un titre de 40 caractères maximum (espaces compris)

Le résultat doit être un objet JSON qui contient, les 3 arguments "pour" et "contre".
Voici le format exact sous lequel doit être fourni la réponse, sous la forme d'un exemple pour le sujet "Les sanctions contre les parents de mineurs délinquants" et la proposition "Effectuer un stage avec l'enfant en sensibilisation":
{
"arguments": [
{
"title": "Renforcement du lien familial",
"text": "Ces stages favorisent le dialogue entre parents et enfants, améliorant leur relation. Les parents peuvent mieux comprendre les difficultés de leurs enfants et les aider à éviter les comportements à risque. Cela contribue à une meilleure communication intrafamiliale.",
"type": "FOR"
},
{
"title": "Prévention de la récidive",
"text": "En sensibilisant parents et enfants aux conséquences des actes délinquants, ces stages les incitent à adopter un comportement responsable, réduisant ainsi les risques de récidive.",
"type": "FOR"
},
{
"title": "Approche éducative",
"text": "Contrairement à des sanctions punitives, ces stages offrent une solution constructive et axée sur l’éducation, permettant d’acquérir des outils pour mieux gérer les situations difficiles.",
"type": "FOR"
},
{
"title": "Contraintes logistiques",
"text": "Les stages peuvent être difficiles à organiser pour les parents ayant un emploi ou des responsabilités multiples, ce qui pourrait les pénaliser injustement.",
"type": "AGAINST"
},
{
"title": "Efficacité limitée",
"text": "Sans un suivi durable, ces stages risquent de ne pas avoir d’effet significatif sur le comportement des enfants ou sur l’encadrement parental.",
"type": "AGAINST"
},
{
"title": "Stigmatisation",
"text": "Certains parents peuvent percevoir cette mesure comme une humiliation, surtout s’ils sont déjà engagés dans l’éducation de leurs enfants.",
"type": "AGAINST"
}
]
}

Voici un autre exemple pour le sujet "Les sanctions contre les parents de mineurs délinquants" et la proposition "Imposer aux parents des formations et un accompagnement éducatif":

{
"arguments": [
{
"title": "Acquisition d’outils pédagogiques",
"text": "Ces formations permettent aux parents de mieux comprendre les besoins de leurs enfants et d’acquérir des stratégies éducatives adaptées, renforçant leur autorité parentale.",
"type": "FOR"
},
{
"title": "Prévention sur le long terme",
"text": "En améliorant les compétences parentales, cette mesure s’attaque aux causes profondes de la délinquance juvénile, réduisant les risques sur le long terme.",
"type": "FOR"
},
{
"title": "Soutien aux familles",
"text": "Ces formations offrent un accompagnement positif, aidant les familles en difficulté à mieux encadrer leurs enfants sans recourir uniquement à des sanctions.",
"type": "FOR"
},
{
"title": "Sentiment d’injustice",
"text": "Les parents risquent de percevoir cette obligation comme une punition, même s’ils font déjà des efforts pour éduquer leurs enfants.",
"type": "AGAINST"
},
{
"title": "Manque de ressources",
"text": "Certaines familles n’ont pas le temps, les moyens ou l’énergie pour participer à ces formations, ce qui peut aggraver leur stress.",
"type": "AGAINST"
},
{
"title": "Efficacité incertaine",
"text": "Sans un cadre personnalisé et un suivi régulier, ces formations risquent d’avoir peu d’impact sur les comportements familiaux.",
"type": "AGAINST"
}
]
}
