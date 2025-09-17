export interface Episode {
  id: string;
  title: string;
  description: string;
  duration: string;
  publishDate: string;
  status: "published" | "draft" | "processing";
  views: number;
  audioUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  featured: boolean;
}

export interface Season {
  id: string;
  title: string;
  description: string;
  episodeCount: number;
  totalViews: number;
  startDate: string;
  endDate?: string;
  episodes: Episode[];
  status: "active" | "completed";
}

export const defaultSeasons: Season[] = [
  {
    id: "1",
    title: "Season 1: AI Fundamentals",
    description: "Exploring foundational AI research papers and breakthroughs",
    episodeCount: 12,
    totalViews: 45200,
    startDate: "2024-01-01",
    status: "active",
    episodes: [
      {
        id: "1",
        title: "Attention Is All You Need",
        description:
          "Deep dive into the transformer architecture that revolutionized AI and natural language processing",
        duration: "24:35",
        publishDate: "2024-01-15",
        status: "published",
        views: 15300,
        audioUrl: "/audio/ep1.wav",
        videoUrl: "/video/ep1.mp4",
        thumbnailUrl: "/thumbnails/ep1.jpg",
        featured: true,
      },
      {
        id: "2",
        title: "BERT: Pre-training of Deep Bidirectional Transformers",
        description: "Understanding how BERT changed the landscape of language understanding",
        duration: "28:42",
        publishDate: "2024-01-22",
        status: "published",
        views: 12800,
        audioUrl: "/audio/ep2.wav",
        videoUrl: "/video/ep2.mp4",
        thumbnailUrl: "/thumbnails/ep2.jpg",
        featured: false,
      },
      {
        id: "3",
        title: "GPT-3: Language Models are Few-Shot Learners",
        description: "Exploring the capabilities and implications of large language models",
        duration: "31:18",
        publishDate: "2024-01-29",
        status: "published",
        views: 18700,
        audioUrl: "/audio/ep3.wav",
        videoUrl: "/video/ep3.mp4",
        thumbnailUrl: "/thumbnails/ep3.jpg",
        featured: true,
      },
      {
        id: "4",
        title: "ResNet: Deep Residual Learning for Image Recognition",
        description: "How residual networks solved the vanishing gradient problem",
        duration: "26:55",
        publishDate: "2024-02-05",
        status: "processing",
        views: 0,
        featured: false,
      },
      {
        id: "5",
        title: "AlphaGo: Mastering the Game of Go with Deep Neural Networks",
        description: "The breakthrough that demonstrated AI's potential in strategic thinking",
        duration: "29:12",
        publishDate: "2024-02-12",
        status: "draft",
        views: 0,
        featured: false,
      },
    ],
  },
  {
    id: "2",
    title: "Season 2: Computer Vision Revolution",
    description: "Covering breakthrough papers in computer vision and image recognition",
    episodeCount: 8,
    totalViews: 32100,
    startDate: "2024-03-01",
    status: "active",
    episodes: [
      {
        id: "6",
        title: "YOLO: Real-Time Object Detection",
        description: "How YOLO changed real-time object detection forever",
        duration: "22:30",
        publishDate: "2024-03-08",
        status: "published",
        views: 9400,
        audioUrl: "/audio/ep6.wav",
        videoUrl: "/video/ep6.mp4",
        thumbnailUrl: "/thumbnails/ep6.jpg",
        featured: false,
      },
      {
        id: "7",
        title: "U-Net: Convolutional Networks for Biomedical Image Segmentation",
        description: "The architecture that revolutionized medical image analysis",
        duration: "25:18",
        publishDate: "2024-03-15",
        status: "published",
        views: 7200,
        audioUrl: "/audio/ep7.wav",
        videoUrl: "/video/ep7.mp4",
        thumbnailUrl: "/thumbnails/ep7.jpg",
        featured: false,
      },
    ],
  },
];
