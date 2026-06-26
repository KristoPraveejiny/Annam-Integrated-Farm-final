// Imports
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiBarChart2, FiFeather, FiShield, FiStar } from 'react-icons/fi';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';

const principles = [
  {
    icon: FiShield,
    title: 'Trust by design',
    text: 'Role-aware access, audit-ready workflows, and clear actions for every user in the farm ecosystem.',
  },
  {
    icon: FiBarChart2,
    title: 'Operational clarity',
    text: 'Dashboards, reporting, and traceability tools that keep farm operations readable at every scale.',
  },
  {
    icon: FiStar,
    title: 'Premium experience',
    text: 'A calm, modern interface with glass panels, strong spacing, and elevated details that feel polished.',
  },
];

const milestones = [
  'Sustainable organic practices for healthy soil and produce',
  'Direct-to-consumer distribution models reducing supply chain waste',
  'Advanced integrated systems for crop and livestock management',
  'Empowering local agriculture through technology and innovation',
];

export default function AboutPage() {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [siteContent, setSiteContent] = useState<any>({});
  const handleImageClick = (img: string) => setSelectedImage(img);
  const closeModal = () => setSelectedImage(null);

  useEffect(() => {
    fetch('/api/site-content')
      .then((response) => response.json())
      .then((data) => setSiteContent(data))
      .catch(() => setSiteContent({}));
  }, []);

  const aboutPage = siteContent['about.about_page'] || {};
  const resolveImageSrc = (img: string) => (img.startsWith('http') || img.startsWith('/uploads') ? `http://localhost:5000${img}` : `/${img}`);
  const getImageLabel = (img: string) => {
    const rawName = img.split('/').pop() || img;
    return rawName.replace(/\.[^.]+$/, '');
  };
  const normalizeImages = (images: any[], fallback: string[]) =>
    (Array.isArray(images) && images.length ? images : fallback).map((item) => {
      if (typeof item === 'string') return { url: item, name: getImageLabel(item) };
      if (item && typeof item === 'object') return { url: item.url || item.path || item.src || '', name: item.name || getImageLabel(item.url || item.path || item.src || '') };
      return { url: '', name: '' };
    }).filter((item) => item.url);
  const liveStockImages = normalizeImages(aboutPage.live_stock_images, ['duck.png', 'cow.jpeg', 'hen.jpeg', 'hen2.png']);
  const cropsImages = normalizeImages(aboutPage.crops_images, ['Banana plant.webp', 'Green-beans.webp', 'green-chilli-plant.webp', 'ladies finger image.jpg', 'paddy field.jpg', 'Papaya-crop.jpg', 'Peanut leaf.jpeg', 'Tomato leaf.jpg']);
  const productsImages = normalizeImages(aboutPage.products_images, ['banana image.jpg', 'beans.jpg', 'Brown-eggs.webp', 'green chilli.webp', 'ladies finger food.jpeg', 'papaw.png', 'tomato.jpg']);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-emerald-800 text-white">
      <PublicHeader active="about" />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden py-12" style={{ backgroundImage: "url('/aboutbackground.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="absolute inset-0 bg-black/30" aria-hidden="true"></div>
          <div className="section-shell relative z-10 glass-bg p-6 rounded-xl max-w-3xl mx-auto mt-12">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
              <h1 className="text-4xl font-extrabold text-white">{aboutPage.hero_title || t("About Annam Integrated Farm")}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-200">
                {aboutPage.hero_subtitle || t("Annam Integrated Farm combines traditional knowledge with modern techniques to grow quality produce and manage healthy livestock.")}
              </p>
              <div className="mt-6">
                <a href="/register"><Button theme="light" className="px-5 py-3">{t("Get Started")}</Button></a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Short 2-line summary */}


        {/* Live Stock Section */}
        <section className="section-shell py-12 bg-white/5 glass-bg">
          <h3 className="text-center text-2xl font-extrabold text-white">{aboutPage.live_stock_title || t("Live Stock")}</h3>
          <p className="mt-3 text-center text-sm text-slate-200">{aboutPage.live_stock_subtitle || t("Scenes of our healthy animals.")}</p>
          <ImageGrid folder="" images={liveStockImages} onImageClick={handleImageClick} />
        </section>
        {/* Crops Section */}
        <section className="section-shell py-12 bg-white/5 glass-bg">
          <h3 className="text-center text-2xl font-extrabold text-white">{aboutPage.crops_title || t("Crops")}</h3>
          <p className="mt-3 text-center text-sm text-slate-200">{aboutPage.crops_subtitle || t("Diverse crops cultivated on our farm.")}</p>
          <ImageGrid folder="" images={cropsImages} onImageClick={handleImageClick} />
        </section>
        {/* Our Products Section */}
        <section className="section-shell py-12 bg-white/5 glass-bg">
          <h3 className="text-center text-2xl font-extrabold text-white">{aboutPage.products_title || t("Our Products")}</h3>
          <p className="mt-3 text-center text-sm text-slate-200">{aboutPage.products_subtitle || t("Fresh produce and products from our farm.")}</p>
          <ImageGrid folder="" images={productsImages} onImageClick={handleImageClick} />
        </section>

        {/* Modal for enlarged image */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            >
              <motion.img
                src={resolveImageSrc(selectedImage)}
                alt={selectedImage}
                className="max-w-[90%] max-h-[90%] rounded-lg shadow-xl"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Milestones */}
        <section className="section-shell py-10">
          <div className="grid gap-6 md:grid-cols-4">
            {milestones.map((item, index) => (
              <div key={item} className="group relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/15 hover:shadow-2xl">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-400">0{index + 1}</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">{t(item)}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

function ImageGrid({ folder, images, onImageClick }: { folder: string; images: { url: string; name: string }[]; onImageClick: (img: string) => void }) {
  const resolveImageSrc = (img: string) => (img.startsWith('http') || img.startsWith('/uploads') ? `http://localhost:5000${img}` : folder ? `/gallery/${folder}/${img}` : `/${img}`);
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {images.map((img) => (
        <button key={img.url} type="button" className="group overflow-hidden rounded-2xl border border-white/15 bg-slate-950/35 p-0 text-left shadow-[0_20px_40px_rgba(2,6,23,0.18)] transition duration-300 hover:-translate-y-1 hover:border-emerald-400/35 hover:shadow-[0_24px_55px_rgba(16,185,129,0.18)]" onClick={() => onImageClick(img.url)}>
          <div className="relative">
            <img src={resolveImageSrc(img.url)} alt={img.name} className="h-60 w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent"></div>
          </div>
          <div className="border-t border-white/10 px-4 py-3">
            <p className="truncate text-sm font-medium text-white/90">{img.name}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
