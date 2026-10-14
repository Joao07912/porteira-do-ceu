import { loadFont as loadSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadSans } from "@remotion/google-fonts/Montserrat";

export const serif = loadSerif("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const sans = loadSans("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;

export const colors = {
  gold: "#F4C46A",
  cream: "#FFF6E3",
  blue: "#1E3A6E",
  night: "#120B05",
};

// Textos do vídeo: edite aqui pra ajustar com o cliente.
export const copy = {
  intro: ["Cada passo do Caminho", "tem a sua história."],
  pilgrim: ["E todo peregrino merece", "uma boa companheira."],
  features: [
    { title: "Leve e resistente", text: "Aguenta o sol, a poeira e os quilômetros." },
    { title: "Mosquetão incluso", text: "Prende na mochila e vai junto, sem peso." },
    { title: "Arte exclusiva", text: "A Porteira do Céu e Nossa Senhora Aparecida." },
  ],
  ctaTop: "Agora você encontra na",
  store: "Porteira do Céu",
  ctaBottom: "Garanta a sua e siga o Caminho com fé.",
  contact: "@porteiradoceu", // TODO: confirmar com o cliente (Instagram / endereço / WhatsApp)
};
