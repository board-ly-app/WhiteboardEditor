import { APP_NAME } from "@/app.config";
import AboutUsInfoCard from "@/components/AboutUsInfoCard";
import Footer from "@/components/Footer";
import HeaderAuthed from "@/components/HeaderAuthed";
import HeaderUnauthed from "@/components/HeaderUnauthed";
import Page from "@/components/Page";
import {
  type User,
} from '@/types/APIProtocol';
import {
  useUser,
} from "@/hooks/useUser";

const AboutUs = () => {
  const user: User | null = useUser().user;

  const title = "About Us";
  const pageTitle = `${title} | ${APP_NAME}`;

  return (
    <Page
      title={pageTitle}
    >
      {user ?
        <HeaderAuthed
          title={title}
        /> :
        <HeaderUnauthed
          title={title}
        />
      }

      {/* Main Container */}
      <div className="flex flex-col mx-20">
        {/* Blurb Section */}
        <div className="flex flex-col items-center">
          <h1 className="text-4xl p-2">How Boardly Began</h1>
          <div className="lg:mx-36 xl:mx-50 pt-8 md:p-12 space-y-6 text-lg font-light">
            <p>
              Boardly was created in the summer of 2025 by two friends at UC Irvine who had worked on enough projects to know how quickly a shared whiteboard can turn into a mess. After watching diagrams shift, disappear, and mysteriously reappear, we decided there had to be a better way. Instead of accepting the chaos, we started building a space where collaboration stays clear and intentional.
            </p>
            <p>
              Boardly gives people the freedom to think together without losing ownership of their work. You can open the door to others or keep things focused until the time is right. Real time collaboration should feel organized, not overwhelming, and that idea continues to guide every decision we make.
            </p>
            <p>
              We are still shaping Boardly and adding features that support the way people actually work. It is an evolving project, and we are committed to improving it step by step. For those who like following products as they grow, stay tuned. There is more on the horizon.
            </p>
          </div>
        </div>
        {/* Connection Section */}
        <div className="flex flex-col">
          <h2 className="text-center text-4xl p-8 mt-8 mb-2">Connect with Us</h2>
          <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
            <AboutUsInfoCard
              name="Oliver Kelton"
              imgSrc="/images/oliverHeadshot.png"
              linkedInImgSrc="/icons/LI-In-Bug.png"
              linkedInLink="https://www.linkedin.com/in/oliver-andrew-k/"
              gitHubImgSrc="/icons/github-mark-white.svg"
              gitHubLink="https://github.com/ollykel"
            />
            <AboutUsInfoCard 
              name="Joe Rogers"
              imgSrc="/images/joeHeadshot.jpeg"
              linkedInImgSrc="/icons/LI-In-Bug.png"
              linkedInLink="https://www.linkedin.com/in/joerogers212/"
              gitHubImgSrc="/icons/github-mark-white.svg"
              gitHubLink="https://github.com/joerogers12"
            />
          </div>
        </div>
      </div>

      <Footer />
    </Page>
  );
}

export default AboutUs;
