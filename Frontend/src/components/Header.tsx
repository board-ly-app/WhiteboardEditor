import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

import {
  TextAlignJustify,
} from "lucide-react";

// === Header ==================================================================
//
// Framework for displaying a floating header at the top of a page. Allows
// setting the title and adding buttons and other elements to toolbars on the
// left and right sides.
//
// =============================================================================

export interface HeaderProps {
  title: string;
  zIndex?: number;
  // Buttons and other elements to display on left side of header
  toolbarElemsLeft?: React.ReactNode[];
  // Buttons and other elements to display on right side of header
  toolbarElemsRight?: React.ReactNode[];
  noMarginTop?: boolean;
}

const Header = ({
  title,
  zIndex = 50,
  toolbarElemsLeft = [],
  toolbarElemsRight = [],
  noMarginTop,
}: HeaderProps): React.JSX.Element => {
  return (
    <>
      {/** Floating header **/}
      <div
        className="fixed top-1 left-0 right-0 max-h-15 backdrop-blur-md shadow-2xl rounded-lg border-border border-1 mx-5 lg:mx-30 m-1 px-3 py-2 bg-bar-background/80"
        style={{ zIndex }}
      > 
        <div className="grid grid-flow-col"> 

          {/* Hamburger Menu */}
          <NavigationMenu className="flex md:hidden">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-header-button-background text-header-button-text hover:cursor-pointer hover:bg-header-button-background hover:text-header-button-text-hover">
                  <TextAlignJustify />
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-dropdown-background">
                  <div className="flex flex-col">
                    {toolbarElemsLeft.map((elem, idx) => (
                      <NavigationMenuLink asChild key={idx}>
                        {elem}
                      </NavigationMenuLink>
                    ))}
                    {toolbarElemsRight.map((elem, idx) => (
                      <NavigationMenuLink asChild key={`right-${idx}`}>
                        {elem}
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Left Side Items */}
          <div className="col-span-1 text-h2-text mx-4 gap-4 hidden md:flex items-center">
            {toolbarElemsLeft}
          </div>

          {/* Title */}
          <h1 className="col-span-1 md:flex-1 min-w-0 text-lg md:text-2xl text-header-title-text font-bold truncate text-center">
            {title}
          </h1>
          
          {/* Right Side Items */}
          <div className="col-span-1 text-h2-text mx-4 gap-4 hidden md:flex items-center justify-end">
            {toolbarElemsRight}
          </div>
        </div>
      </div>
      {/** Dummy static element to ensure header doesn't overlap top of page **/}
      {(!noMarginTop &&
        <div className="h-25">
        </div>
      )}
    </>
  );
};

export default Header;
