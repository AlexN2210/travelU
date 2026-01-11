import { MapPin, Users, Vote, DollarSign, CheckSquare, Route, Sparkles } from 'lucide-react';
import logo from '../public/logo.png';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const features = [
    {
      icon: <Route className="w-10 h-10" />,
      title: 'Voyage simple ou Road trip',
      description: 'Créez des voyages à destination unique ou planifiez des road trips avec plusieurs étapes.',
      color: 'gold'
    },
    {
      icon: <MapPin className="w-10 h-10" />,
      title: 'Carte interactive',
      description: 'Visualisez toutes vos étapes sur une carte avec marqueurs numérotés et itinéraires.',
      color: 'turquoise'
    },
    {
      icon: <Users className="w-10 h-10" />,
      title: 'Collaboration',
      description: 'Invitez vos amis par email ou lien unique. Gérez les permissions lecture/édition.',
      color: 'palm-green'
    },
    {
      icon: <Vote className="w-10 h-10" />,
      title: 'Vote collaboratif',
      description: 'Votez ensemble pour les logements, activités et restaurants. Décidez en groupe facilement.',
      color: 'turquoise'
    },
    {
      icon: <DollarSign className="w-10 h-10" />,
      title: 'Gestion des frais',
      description: 'Suivez les dépenses partagées. Calcul automatique de qui doit quoi à qui.',
      color: 'gold'
    },
    {
      icon: <CheckSquare className="w-10 h-10" />,
      title: 'Checklist intelligente',
      description: 'Checklist générée automatiquement selon la destination, la météo et le type de voyage.',
      color: 'palm-green'
    }
  ];

  const getIconColor = (color: string) => {
    const colors: Record<string, string> = {
      'gold': 'text-gold',
      'turquoise': 'text-turquoise',
      'palm-green': 'text-palm-green'
    };
    return colors[color] || 'text-gold';
  };

  return (
    <div className="min-h-screen bg-cream font-body">
      {/* Header */}
      <nav className="bg-white shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img 
                src={logo} 
                alt="TravelU Logo" 
                className="w-10 h-10 object-contain"
              />
              <h1 className="text-2xl font-heading font-bold text-dark-gray">TravelU</h1>
            </div>
            <button
              onClick={onLogin}
              className="px-6 py-2.5 text-dark-gray hover:text-turquoise font-body font-medium transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center mb-12">
            <div className="inline-block mb-6">
              <Sparkles className="w-16 h-16 text-gold mx-auto" />
            </div>
            <h2 className="text-5xl md:text-6xl font-heading font-bold text-dark-gray mb-6 leading-tight">
              Votre voyage, ensemble et organisé
            </h2>
            <p className="text-xl md:text-2xl text-dark-gray/70 mb-10 max-w-3xl mx-auto leading-relaxed">
              Planifiez, collaborez et profitez pleinement de vos voyages en groupe.
              TravelU simplifie l'organisation de vos aventures du début à la fin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onGetStarted}
                className="px-10 py-4 bg-gold text-white text-lg font-body font-bold rounded-button hover:bg-gold/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
              >
                S'inscrire
              </button>
              <button
                onClick={() => {
                  // Fonctionnalité "Découvrir la démo" - peut être implémentée plus tard
                  window.scrollTo({ top: document.querySelector('.features-section')?.getBoundingClientRect().top || 0, behavior: 'smooth' });
                }}
                className="px-10 py-4 bg-turquoise text-white text-lg font-body font-bold rounded-button hover:bg-turquoise/90 transition-all shadow-medium hover:shadow-lg transform hover:-translate-y-1 tracking-wide"
              >
                Découvrir la démo
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section bg-cream py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-4xl font-heading font-bold text-dark-gray mb-12 text-center">
              Tout ce dont vous avez besoin pour voyager ensemble
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-soft hover:shadow-medium transition-all transform hover:-translate-y-1"
                >
                  <div className={`${getIconColor(feature.color)} mb-5`}>{feature.icon}</div>
                  <h3 className="text-2xl font-heading font-semibold text-dark-gray mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-dark-gray/70 font-body leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works Section */}
        <section className="bg-white py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-cream rounded-3xl shadow-medium p-8 md:p-12">
              <h3 className="text-4xl font-heading font-bold text-dark-gray mb-12 text-center">
                Comment ça marche ?
              </h3>
              <div className="grid md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gold to-turquoise text-white rounded-full flex items-center justify-center text-2xl font-heading font-bold mx-auto mb-5 shadow-medium">
                    1
                  </div>
                  <h4 className="font-heading font-semibold text-dark-gray mb-2 text-lg">Créez votre voyage</h4>
                  <p className="text-dark-gray/70 font-body text-sm leading-relaxed">
                    Définissez les dates et le type de voyage
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-turquoise to-gold text-white rounded-full flex items-center justify-center text-2xl font-heading font-bold mx-auto mb-5 shadow-medium">
                    2
                  </div>
                  <h4 className="font-heading font-semibold text-dark-gray mb-2 text-lg">Invitez vos amis</h4>
                  <p className="text-dark-gray/70 font-body text-sm leading-relaxed">
                    Partagez par email ou lien unique
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gold to-palm-green text-white rounded-full flex items-center justify-center text-2xl font-heading font-bold mx-auto mb-5 shadow-medium">
                    3
                  </div>
                  <h4 className="font-heading font-semibold text-dark-gray mb-2 text-lg">Planifiez ensemble</h4>
                  <p className="text-dark-gray/70 font-body text-sm leading-relaxed">
                    Ajoutez étapes, votez, gérez les frais
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-turquoise to-palm-green text-white rounded-full flex items-center justify-center text-2xl font-heading font-bold mx-auto mb-5 shadow-medium">
                    4
                  </div>
                  <h4 className="font-heading font-semibold text-dark-gray mb-2 text-lg">Partez serein</h4>
                  <p className="text-dark-gray/70 font-body text-sm leading-relaxed">
                    Checklist complète et tout est organisé
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-cream py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img 
                src={logo} 
                alt="TravelU Logo" 
                className="w-8 h-8 object-contain"
              />
              <p className="text-dark-gray font-body">TravelU</p>
            </div>
            <div className="flex flex-wrap gap-6 justify-center md:justify-end">
              <a href="#" className="text-dark-gray hover:text-turquoise font-body transition-colors">À propos</a>
              <a href="#" className="text-dark-gray hover:text-turquoise font-body transition-colors">Contact</a>
              <a href="#" className="text-dark-gray hover:text-turquoise font-body transition-colors">Mentions légales</a>
              <a href="#" className="text-dark-gray hover:text-turquoise font-body transition-colors">Confidentialité</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-cream text-center">
            <p className="text-dark-gray/60 font-body text-sm">
              © 2024 TravelU - Planifiez vos voyages en groupe facilement
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
