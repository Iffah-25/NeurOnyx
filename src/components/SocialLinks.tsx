import React from 'react';
import { Linkedin, Globe, Instagram, MessageCircle } from 'lucide-react';

export default function SocialLinks() {
  const links = [
    {
      icon: <Linkedin size={20} />,
      href: "https://www.linkedin.com/company/neuronyx-club/",
      label: "LinkedIn",
      color: "hover:text-blue-500"
    },
    {
      icon: <Globe size={20} />,
      href: "https://neuronyx.aiktc.ac.in/",
      label: "Website",
      color: "hover:text-brand-accent"
    },
    {
      icon: <Instagram size={20} />,
      href: "https://www.instagram.com/neuronyx_aiktc?igsh=bDkzeHNnOGFhNXRi",
      label: "Instagram",
      color: "hover:text-pink-500"
    },
    {
      icon: <MessageCircle size={20} />,
      href: "https://whatsapp.com/channel/0029VbBAGiJ8kyyNrMOz1I0P",
      label: "WhatsApp",
      color: "hover:text-green-500"
    }
  ];

  return (
    <div className="flex items-center gap-6">
      {links.map((link, index) => (
        <a
          key={index}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-white/40 transition-colors ${link.color}`}
          title={link.label}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}
