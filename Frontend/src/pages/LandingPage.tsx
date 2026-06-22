import { motion } from 'framer-motion';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { FiArrowRight, FiCheckCircle, FiCpu, FiFeather, FiGrid, FiShield, FiShoppingBag, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';

import { PublicHeader } from '../components/layout/PublicHeader';
import { features, landingStats, testimonials } from '../data/mock';
import { FiMapPin, FiMail, FiPhone } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const featureIcons = [FiCpu, FiFeather, FiShield, FiShoppingBag];

export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_24%),linear-gradient(180deg,#eaf8ef_0%,#dff3e8_34%,#f6fbf7_100%)] text-slate-900">
      <PublicHeader active="home" />

      <main>
        <section
          className="relative overflow-hidden bg-cover bg-center text-white"
          style={{ backgroundImage: "url('/hero-custom.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="section-shell relative grid min-h-[72vh] items-center gap-8 py-12 lg:grid-cols-1 lg:py-16">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-white/90 backdrop-blur-md shadow-sm">{t("Smart Farming Platform")}</div>
              <h2 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.02]">{t("Smart Farming for Better Productivity and Decision-Making")}</h2>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-emerald-50 md:text-lg">{t("Manage crops, livestock, workforce, marketplace, and AI-powered farming insights in one intelligent platform.")}</p>

              <div className="mt-6 flex justify-center flex-wrap gap-4 items-center">
                <a href="/register"><Button theme="light" className="px-6 py-4 text-base">{t("Get Started")} <FiArrowRight className="ml-2" /></Button></a>
                <a href="#about-us"><Button theme="light" variant="secondary" className="px-6 py-4 text-base">{t("Learn More")}</Button></a>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 justify-center mx-auto">
                {landingStats.map((stat) => (
                  <div key={stat.label} className="farm-card p-4 bg-white/6">
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="mt-1 text-sm text-emerald-50/90">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right-side control panel removed as requested */}
          </div>
        </section>

        <section id="about-us" className="bg-[linear-gradient(180deg,#e8f7ec_0%,#f4fbf6_100%)] py-20">
          <div className="section-shell">
            <div className="grid gap-8 items-center lg:grid-cols-2">
              <div className="order-1 lg:order-0">
                <img src="/Annam.jpeg" alt="Annam Integrated Farm" className="w-full h-80 object-cover rounded-xl" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">{t("About Us")}</p>
                <h3 className="mt-4 text-3xl md:text-4xl font-extrabold text-slate-900">
                  {t("About Annam Integrated Farm: Cultivating Sustainability and Growth")}
                </h3>
                <p className="mt-4 text-lg leading-8 text-slate-700">
                  {t("Annam Integrated Farm combines modern techniques with traditional knowledge to create a sustainable, productive farming environment.")}
                  {t("We focus on crop and livestock integration, environmental stewardship, and community development.")}
                </p>
                <div className="mt-6 grid w-full grid-cols-2 gap-4 sm:w-auto sm:grid-cols-4">
                  <FeaturePill icon={<FiFeather />} label={t("Pure Produce")} />
                  <FeaturePill icon={<FiShield />} label={t("Trusted")} />
                  <FeaturePill icon={<FiTrendingUp />} label={t("Fast Delivery")} />
                  <FeaturePill icon={<FiUsers />} label={t("Community")} />
                </div>
                <div className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
                  <p><strong>{t("Annam Integrated Farm")}</strong> {t("is dedicated to promoting sustainable and efficient farming practices. The farm integrates crop cultivation with livestock management to create a balanced and productive farming environment.")}</p>
                  <p>{t("The farm is committed to improving agricultural productivity, supporting food security, and providing opportunities for learning and innovation in farming. Through responsible resource management and continuous improvement, Annam Integrated Farm strives to serve as a model for integrated farming practices.")}</p>
                </div>
                <div className="mt-6">
                  <a href="/about"><Button theme="light">{t("Read More")}</Button></a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-[linear-gradient(180deg,#edf9ef_0%,#f5fbf7_100%)] py-20">
          <div className="section-shell">
            <SectionHeading eyebrow={t("Services")} title={t("Comprehensive farm services")} description={t("We provide on-ground and digital services to run farms efficiently.")} />

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { title: 'Farm Planning', desc: 'Layout planning, crop rotation and scheduling.', img: '/paddy field.jpg' },
                { title: 'Crop Monitoring', desc: 'AI-powered image detection and alerts.', img: '/Tomato leaf.jpg' },
                { title: 'Resource Management', desc: 'Inventory, inputs and workforce management.', img: '/beans.jpg' },
                { title: 'Agricultural Analytics', desc: 'Reports, forecasting and KPI dashboards.', img: '/fresh-milk-1.jpg' },
                { title: 'Equipment Tracking', desc: 'GPS and maintenance scheduling for machinery.', img: '/hero-custom.jpg' },
                { title: 'Irrigation Optimization', desc: 'Smart water scheduling and sensors integration.', img: '/paddy field.jpg' },
              ].map((s) => (
                <div key={s.title} className="relative overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(2,6,23,0.06)]">
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/30 transition" />
                  <div style={{ backgroundImage: `url('${s.img}')` }} className="relative h-40 bg-cover bg-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>
                  <div className="p-6 bg-gradient-to-t from-emerald-50/95 to-white/90">
                    <h4 className="text-lg font-semibold text-slate-900">{t(s.title)}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{t(s.desc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard preview removed */}

        <section id="benefits" className="relative overflow-hidden bg-[linear-gradient(180deg,#edf8ef_0%,#f5fbf8_100%)] py-20">
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-6 h-72 w-72 rounded-full bg-lime-200/25 blur-3xl" />

          <div className="section-shell relative">
            <SectionHeading eyebrow={t("Benefits")} title={t("Why choose Annam Integrated Farm")} description={t("Data-driven agriculture that improves yield while reducing costs.")} />

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { title: 'Increase Productivity', metric: '+18% Avg Output', icon: FiTrendingUp },
                { title: 'Reduce Costs', metric: '-12% Input Waste', icon: FiShield },
                { title: 'Improve Crop Yield', metric: '+22% Seasonal Yield', icon: FiCheckCircle },
                { title: 'Real-Time Monitoring', metric: '24/7 Visibility', icon: FiCpu },
                { title: 'Data-Driven Decision Making', metric: 'Live KPI Dashboards', icon: FiGrid },
                { title: 'Seamless Team Collaboration', metric: 'Role-Based Workflows', icon: FiUsers },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.title} className="group relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-white/90 p-6 shadow-[0_14px_35px_rgba(2,6,23,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(16,185,129,0.16)]">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-300" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-slate-900">{t(b.title)}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t(b.metric)}</p>
                      </div>
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white">
                        <Icon className="text-lg" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{t("Practical tools, real-time insights, and dependable workflows that help farm teams scale with confidence.")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>


        {/* Icon / feature strip similar to the provided design image */}


        {/* About moved to its own page: /about */}

        {/* Features section removed per request */}




        <section className="bg-[linear-gradient(180deg,#edf8ef_0%,#f7fbf8_100%)] py-20">
          <div className="section-shell">
            <SectionHeading eyebrow={t("Testimonials")} title={t("Built to feel trustworthy and premium")} />
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card variant="light" key={testimonial.name}>
                  <p className="text-base leading-7 text-slate-700">“{testimonial.quote}”</p>
                  <p className="mt-4 text-sm font-bold text-emerald-700">{testimonial.name}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[linear-gradient(180deg,#eef8f1_0%,#f5fbf7_100%)] py-20">
          <div className="section-shell grid gap-6 lg:grid-cols-2">
            <ContactForm />
            <div className="rounded-3xl border border-emerald-100 bg-white/88 p-6 shadow-[0_14px_35px_rgba(2,6,23,0.06)] backdrop-blur">
              <p className="text-lg font-bold text-slate-900">{t("Contact Details")}</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{t("We are based in your region and offer on-ground support and remote advisory.")}</p>
              <div className="mt-6 space-y-4 text-sm text-slate-700">
                <div className="flex items-center gap-3"><FiMapPin className="text-emerald-600" /> <span>No,565/12, Tharmapuram East,Tharmapuram, Kilinochi Srilanka</span></div>
                <div className="flex items-center gap-3"><FiMail className="text-emerald-600" /> <span>annamintegratedfarm@gmail.com</span></div>
                <div className="flex items-center gap-3"><FiPhone className="text-emerald-600" /> <span>+94 777244377</span></div>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 shadow-[0_14px_35px_rgba(2,6,23,0.08)]">
                <iframe
                  title="Annam Integrated Farm location"
                  src="https://www.google.com/maps?q=No%20565%2F12%2C%20Tharmapuram%20East%2C%20Tharmapuram%2C%20Kilinochi%2C%20Sri%20Lanka&output=embed"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </section>
      </main >

      <footer className="border-t border-emerald-100 bg-white py-12">
        <div className="section-shell grid gap-8 md:grid-cols-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">{t("Annam Integrated Farm")}</h4>
            <p className="mt-2 text-sm text-slate-600">{t("Premium farm management platform — dashboards, AI advisories, and marketplace.")}</p>
          </div>

          <div>
            <h5 className="text-sm font-semibold text-slate-800">{t("Quick Links")}</h5>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="/" className="hover:text-emerald-600">{t("Home")}</a></li>
              <li><a href="/about" className="hover:text-emerald-600">{t("About")}</a></li>
              <li><a href="/#features" className="hover:text-emerald-600">{t("Features")}</a></li>
              <li><a href="/marketplace" className="hover:text-emerald-600">{t("Marketplace")}</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-semibold text-slate-800">{t("Services")}</h5>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>{t("Farm Planning")}</li>
              <li>{t("Crop Monitoring")}</li>
              <li>{t("Analytics")}</li>
              <li>{t("Equipment Tracking")}</li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-semibold text-slate-800">{t("Follow Us")}</h5>
            <div className="mt-3 flex items-center gap-3">
              <a className="h-10 w-10 rounded-full bg-emerald-50 grid place-items-center text-emerald-700" href="#">In</a>
              <a className="h-10 w-10 rounded-full bg-emerald-50 grid place-items-center text-emerald-700" href="#">Fb</a>
              <a className="h-10 w-10 rounded-full bg-emerald-50 grid place-items-center text-emerald-700" href="#">Tw</a>
            </div>
          </div>
        </div>

        <div className="section-shell mt-8 border-t border-emerald-100 pt-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} {t("Annam Integrated Farm. All rights reserved.")}</div>
      </footer>
    </div >
  );
}

function BadgeItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-[0_10px_25px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      {icon}
      {text}
    </div>
  );
}

function MiniProduct({ title, price }: { title: string; price: string }) {
  return (
    <div className="rounded-3xl border border-white/35 bg-white/70 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(16,185,129,0.12)]">
      <div className="h-28 rounded-2xl bg-gradient-to-br from-emerald-100/90 via-lime-100/80 to-white/90" />
      <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
      <p className="text-sm text-emerald-700">{price}</p>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_10px_25px_rgba(2,6,23,0.08)]">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-bold">{label}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white to-emerald-50 p-6 text-center shadow-[0_12px_30px_rgba(2,6,23,0.06)]">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-emerald-700">{value}</p>
    </div>
  );
}

function ContactForm() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100';

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setFeedback('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send your message.');
      }

      setFormData({ full_name: '', email: '', phone: '', subject: '', message: '' });
      setStatus('success');
      setFeedback(t('Your message has been sent successfully. Our team will contact you soon.'));
    } catch (err) {
      setStatus('error');
      setFeedback(err instanceof Error ? err.message : t('Failed to send your message.'));
    }
  };

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
      <p className="text-lg font-bold text-slate-900">{t("Contact Us")}</p>
      <p className="mt-2 text-sm text-slate-600">{t("Send us a message and we'll get back to you.")}</p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className={inputClass} placeholder={t("Full name")} value={formData.full_name} onChange={(event) => updateField('full_name', event.target.value)} required />
        <input className={inputClass} placeholder={t("Email")} type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} required />
        <input className={inputClass} placeholder={t("Phone")} value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} />
        <input className={inputClass} placeholder={t("Subject")} value={formData.subject} onChange={(event) => updateField('subject', event.target.value)} required />
        <textarea className={`${inputClass} col-span-2 h-32 resize-none`} placeholder={t("Message")} value={formData.message} onChange={(event) => updateField('message', event.target.value)} required />
        {feedback ? (
          <p className={`col-span-2 rounded-2xl px-4 py-3 text-sm font-medium ${status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {feedback}
          </p>
        ) : null}
        <div className="col-span-2 text-right">
          <Button theme="light" disabled={status === 'submitting'}>{status === 'submitting' ? t('Sending...') : t('Send Message')}</Button>
        </div>
      </form>
    </div>
  );
}      

