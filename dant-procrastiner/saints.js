// Calendrier des saints (calendrier français usuel), un tableau par mois, index 0 = le 1er.
export const SAINTS = [
  ['Marie, Mère de Dieu','Basile','Geneviève','Odilon','Édouard','Mélaine','Raymond','Lucien','Alix','Guillaume','Paulin','Tatiana','Yvette','Nina','Rémi','Marcel','Roseline','Prisca','Marius','Sébastien','Agnès','Vincent','Barnard','François de Sales','Conversion de Paul','Paule','Angèle','Thomas d’Aquin','Gildas','Martine','Marcelle'],
  ['Ella','Théophane','Blaise','Véronique','Agathe','Gaston','Eugénie','Jacqueline','Apolline','Arnaud','Notre-Dame de Lourdes','Félix','Béatrice','Valentin','Claude','Julienne','Alexis','Bernadette','Gabin','Aimée','Pierre Damien','Isabelle','Lazare','Modeste','Roméo','Nestor','Honorine','Romain','Auguste'],
  ['Aubin','Charles le Bon','Guénolé','Casimir','Olive','Colette','Félicité','Jean de Dieu','Françoise','Vivien','Rosine','Justine','Rodrigue','Mathilde','Louise','Bénédicte','Patrice','Cyrille','Joseph','Herbert','Clémence','Léa','Victorien','Catherine de Suède','Humbert','Larissa','Habib','Gontran','Gwladys','Amédée','Benjamin'],
  ['Hugues','Sandrine','Richard','Isidore','Irène','Marcellin','Jean-Baptiste de la Salle','Julie','Gautier','Fulbert','Stanislas','Jules','Ida','Maxime','Paterne','Benoît-Joseph','Anicet','Parfait','Emma','Odette','Anselme','Alexandre','Georges','Fidèle','Marc','Alida','Zita','Valérie','Catherine de Sienne','Robert'],
  ['Jérémie','Boris','Philippe et Jacques','Sylvain','Judith','Prudence','Gisèle','Désiré','Pacôme','Solange','Estelle','Achille','Rolande','Matthias','Denise','Honoré','Pascal','Éric','Yves','Bernardin','Constantin','Émile','Didier','Donatien','Sophie','Bérenger','Augustin de Cantorbéry','Germain','Aymar','Ferdinand','Perrine'],
  ['Justin','Blandine','Kévin','Clotilde','Igor','Norbert','Gilbert','Médard','Diane','Landry','Barnabé','Guy','Antoine de Padoue','Élisée','Germaine','Jean-François Régis','Hervé','Léonce','Romuald','Silvère','Rodolphe','Alban','Audrey','Jean-Baptiste','Prosper','Anthelme','Fernand','Irénée','Pierre et Paul','Martial'],
  ['Thierry','Martinien','Thomas','Florent','Antoine','Mariette','Raoul','Thibaut','Amandine','Ulrich','Benoît','Olivier','Henri et Joël','Camille','Donald','Notre-Dame du Mont-Carmel','Charlotte','Frédéric','Arsène','Marina','Victor','Marie-Madeleine','Brigitte','Christine','Jacques','Anne et Joachim','Nathalie','Samson','Marthe','Juliette','Ignace de Loyola'],
  ['Alphonse','Julien Eymard','Lydie','Jean-Marie Vianney','Abel','Octavien','Gaétan','Dominique','Amour','Laurent','Claire','Clarisse','Hippolyte','Evrard','Marie','Armel','Hyacinthe','Hélène','Jean Eudes','Bernard','Christophe','Fabrice','Rose de Lima','Barthélemy','Louis','Natacha','Monique','Augustin','Sabine','Fiacre','Aristide'],
  ['Gilles','Ingrid','Grégoire','Rosalie','Raïssa','Bertrand','Reine','Adrien','Alain','Inès','Adelphe','Apollinaire','Aimé','Croix Glorieuse','Roland','Édith','Renaud','Nadège','Émilie','Davy','Matthieu','Maurice','Constant','Thècle','Hermann','Côme et Damien','Vincent de Paul','Venceslas','Michel, Gabriel et Raphaël','Jérôme'],
  ['Thérèse de l’Enfant-Jésus','Léger','Gérard','François d’Assise','Fleur','Bruno','Serge','Pélagie','Denis','Ghislain','Firmin','Wilfried','Géraud','Juste','Thérèse d’Avila','Edwige','Baudoin','Luc','René','Adeline','Céline','Élodie','Jean de Capistran','Florentin','Crépin','Dimitri','Émeline','Simon et Jude','Narcisse','Bienvenue','Quentin'],
  ['Tous les saints','Défunts','Hubert','Charles','Sylvie','Bertille','Carine','Geoffroy','Théodore','Léon','Martin','Christian','Brice','Sidoine','Albert','Marguerite','Élisabeth','Aude','Tanguy','Edmond','Présentation de Marie','Cécile','Clément','Flora','Catherine','Delphine','Séverin','Jacques de la Marche','Saturnin','André'],
  ['Florence','Viviane','François-Xavier','Barbara','Gérald','Nicolas','Ambroise','Immaculée Conception','Pierre Fourier','Romaric','Daniel','Jeanne-Françoise de Chantal','Lucie','Odile','Ninon','Alice','Gaël','Gatien','Urbain','Théophile','Pierre Canisius','Françoise-Xavière','Armand','Adèle','Noël','Étienne','Jean','Saints Innocents','David','Roger','Sylvestre'],
];

// Jours fériés à date fixe, affichés à la place du « Bonne fête ».
const FIXED = { '1-1': 'Jour de l’An', '5-1': 'Fête du Travail', '5-8': 'Victoire 1945', '7-14': 'Fête nationale', '8-15': 'Assomption', '11-1': 'Toussaint', '11-11': 'Armistice', '12-25': 'Noël' };
const NOT_A_NAME = /^(Marie, Mère|Conversion|Notre-Dame|Croix|Tous les|Défunts|Présentation|Immaculée|Noël|Saints Innocents)/;

export function saintOfDay(d = new Date()) {
  const name = SAINTS[d.getMonth()][d.getDate() - 1];
  const holiday = FIXED[`${d.getMonth() + 1}-${d.getDate()}`] || null;
  const isName = !NOT_A_NAME.test(name);
  return { name, holiday, line: isName ? `Bonne fête aux ${name} !` : `Aujourd’hui : ${name}` };
}
