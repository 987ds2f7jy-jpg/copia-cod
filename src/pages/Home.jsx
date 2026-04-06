import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, Clock, MessageSquare, Shield, Star, 
  ArrowRight, CheckCircle, Stethoscope, Heart,
  Brain, Bone, Eye, Baby, UserRound, ClipboardList
} from 'lucide-react';

const specialties = [
  { name: 'Clínico Geral', icon: Stethoscope, color: 'bg-emerald-100 text-emerald-600' },
  { name: 'Cardiologia', icon: Heart, color: 'bg-red-100 text-red-600' },
  { name: 'Neurologia', icon: Brain, color: 'bg-purple-100 text-purple-600' },
  { name: 'Ortopedia', icon: Bone, color: 'bg-blue-100 text-blue-600' },
  { name: 'Oftalmologia', icon: Eye, color: 'bg-amber-100 text-amber-600' },
  { name: 'Pediatria', icon: Baby, color: 'bg-pink-100 text-pink-600' },
];

const features = [
  {
    icon: Clock,
    title: 'Consulta em Minutos',
    description: 'Conecte-se com um médico disponível agora mesmo, sem espera.'
  },
  {
    icon: Search,
    title: 'Escolha seu Especialista',
    description: 'Busque por especialidade ou profissional específico.'
  },
  {
    icon: MessageSquare,
    title: 'Tire suas Dúvidas',
    description: 'Pergunte a especialistas e receba respostas qualificadas.'
  },
  {
    icon: Shield,
    title: 'Seguro e Confiável',
    description: 'Todos os profissionais verificados e credenciados.'
  }
];

const steps = [
  { number: '01', title: 'Escolha a especialidade', description: 'Selecione o tipo de atendimento que precisa' },
  { number: '02', title: 'Agende ou entre na fila', description: 'Marque horário ou seja atendido agora' },
  { number: '03', title: 'Realize sua consulta', description: 'Converse por vídeo com seu médico' },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-20 pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
          <div className="absolute top-60 -left-20 w-72 h-72 bg-teal-200/30 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-6">
                <Clock className="w-4 h-4" />
                Atendimento 24 horas
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Seu médico a um
                <span className="text-emerald-600"> clique </span>
                de distância
              </h1>
              
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                Conectamos você aos melhores profissionais de saúde. Agende consultas, 
                entre na fila para atendimento imediato ou tire suas dúvidas com especialistas.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={createPageUrl('ConsultaAgora')}>
                  <Button size="lg" className="w-full sm:w-auto gradient-primary border-0 text-white hover:opacity-90 h-14 px-8 text-base">
                    <Clock className="w-5 h-5 mr-2" />
                    Consulta Agora
                  </Button>
                </Link>
                <Link to={createPageUrl('Especialidades')}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base">
                    Agendar Consulta
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center gap-6 mt-10">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                      <UserRound className="w-5 h-5 text-gray-500" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">+10.000 pacientes satisfeitos</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=700&fit=crop"
                  alt="Médica sorrindo"
                  className="rounded-3xl shadow-2xl w-full object-cover"
                />
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">500+ Profissionais</p>
                    <p className="text-sm text-gray-500">Verificados e ativos</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Encontre o especialista ideal
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Mais de 15 especialidades médicas disponíveis para você escolher
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specialties.map((specialty, index) => (
              <motion.div
                key={specialty.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link to={createPageUrl(`Especialidades?especialidade=${encodeURIComponent(specialty.name)}`)}>
                  <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 shadow-sm">
                    <CardContent className="p-6 text-center">
                      <div className={`w-14 h-14 rounded-2xl ${specialty.color} flex items-center justify-center mx-auto mb-4`}>
                        <specialty.icon className="w-7 h-7" />
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{specialty.name}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to={createPageUrl('Especialidades')}>
              <Button variant="outline" size="lg">
                Ver todas as especialidades
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Serviços Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Serviços</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Link to="/SolicitacaoExames">
                <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 shadow-sm h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-4">
                      <ClipboardList className="w-7 h-7" />
                    </div>
                    <p className="font-medium text-gray-900 text-sm mb-1">Solicitação de Exames</p>
                    <p className="text-xs text-gray-500">Pedidos digitais para exames laboratoriais e de imagem com orientação médica.</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Link to="/RenovacaoReceitas">
                <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 shadow-sm h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">💊</span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm mb-1">Renovação de Receitas</p>
                    <p className="text-xs text-gray-500">Prescrições rápidas com envio digital para medicações de uso contínuo.</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Como funciona
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Em poucos passos você já estará conectado com seu médico
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="text-6xl font-bold text-emerald-100 mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 w-1/2 h-0.5 bg-emerald-100" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl gradient-primary p-12 lg:p-16">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                  Pronto para cuidar da sua saúde?
                </h2>
                <p className="text-white/90 text-lg mb-8">
                  Milhares de pessoas já transformaram a forma como cuidam da saúde. 
                  Junte-se a elas.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to={createPageUrl('ConsultaAgora')}>
                    <Button size="lg" className="w-full sm:w-auto bg-white text-emerald-600 hover:bg-emerald-50 h-14 px-8">
                      Começar Agora
                    </Button>
                  </Link>
                  <Link to={createPageUrl('CadastroProfissional')}>
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10 h-14 px-8">
                      Sou Profissional
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="hidden lg:flex justify-center">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/20 backdrop-blur rounded-2xl p-6 text-white">
                    <div className="text-4xl font-bold">500+</div>
                    <div className="text-white/80">Médicos ativos</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-2xl p-6 text-white mt-8">
                    <div className="text-4xl font-bold">24h</div>
                    <div className="text-white/80">Disponibilidade</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-2xl p-6 text-white">
                    <div className="text-4xl font-bold">15+</div>
                    <div className="text-white/80">Especialidades</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-2xl p-6 text-white mt-8">
                    <div className="text-4xl font-bold">10k+</div>
                    <div className="text-white/80">Consultas/mês</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}