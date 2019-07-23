/*

---
title: Clearing table module
name: clearing-table-module
category: Javascript
---

 */

/*
 * Downloading a backup clearing data file
 * Essentially, you can visit the API url below using the sheet ID
 * https://spreadsheets.google.com/feeds/list/[sheetId]/1/public/values?alt=json
 *
 * Then save it as a JSON file and upload to /static/data/clearing/[yyyy].json
 */

define(['jquery', 'app/searchables', 'app/utils', 'app/modal-link'],
  function ($, SEARCHABLE, UTILS, MODALLINK) {

  // Toggle this value to enable/disable clearing info on course search results pages
  var courseSearchClearingFeatures = true;

  var $window = $(window);
  var clearingData = window.PL_DATA.clearingData;
  var sheetId = clearingData.sheetId;
  var backupDoc = clearingData.backupDoc;
  var letterLimit = 5;
  var searchLimit = 20;

  var makeLink = function(course, courseCount) {
    var link = './'+course.Department.toLowerCase().replace(/:/g, '').replace(/,/g, '').replace(/\s/g, '-');
    var a = $('<a>').addClass('c-clearing-list__link')
                  .attr('href', link)
                  .text(course.Department);
    var li = $('<li>').addClass('c-clearing-list__item')
                      .attr('data-department', course.Department)
                      .append(a);

    // Not sure if this does anything anymore?
    // Add markers to UK/EU-only or International-only departments
    if (courseCount['UK/EU'] === 0 && courseCount['Adjustment UK/EU'] === 0) {
      // International courses only
      li.addClass('is-international-only');
      // li.append('&nbsp;<small class="c-clearing-list__comment">Places for international students only</small>');
  } else if (courseCount.International === 0 && courseCount['Adjustment International'] === 0) {
      // UK/EU courses only
      li.addClass('is-ukeu-only');
      // li.append('&nbsp;<small class="c-clearing-list__comment">Places for UK/EU students only</small>');
    }

    // Append an availability note?
    var note = makeAvailabilityNote( {
      'Home/EU': ( courseCount['UK/EU'] > 0 ? 'y' : 'n' ),
      'International': ( courseCount.International > 0 ? 'y' : 'n' ),
      'Adjustment only home/EU': ( courseCount['Adjustment UK/EU'] > 0 ? 'y' : 'n' ),
      'Adjustment only international': ( courseCount['Adjustment International'] > 0 ? 'y' : 'n' ),
    } );
    if( note ) li.append('&nbsp;<small class="c-clearing-list__comment">'+note+'</small>');

    return li;
  };

  var makeAvailabilityNote = function( course ) {

    var clearing_home = ( course['Home/EU'].toLowerCase() == 'y' );
    var clearing_intl = ( course.International.toLowerCase() == 'y' );
    var adjustment_home = ( course['Adjustment only home/EU'].toLowerCase() == 'y' );
    var adjustment_intl = ( course['Adjustment only international'].toLowerCase() == 'y' );

    // Clearing throughout
    if( clearing_home && clearing_intl ) return false; // No label required
    // Partial clearing
    if( clearing_home && !adjustment_intl ) return "Places for UK/EU students only";
    if( clearing_intl && !adjustment_home ) return "Places for international students only";
    // Partial clearing + partial adjustment
    if( clearing_home && adjustment_intl ) return "Places for UK/EU students, adjustment places only for international students";
    if( clearing_intl && adjustment_home ) return "Places for international students, adjustment places only for UK/EU students";
    // Adjustment only
    if( adjustment_home && adjustment_intl ) return "Adjustment places only";
    // Partial adjustment
    if( adjustment_home && !adjustment_intl ) return "Adjustment places for UK/EU students only";
    if( adjustment_intl && !adjustment_home ) return "Adjustment places for international students only";

    return false; // This shouldn't happen
  };

  var CLEARINGTABLE = function (options) {

    if (!options.container) return false;

    this.type = options.type || 'Both';
    this.department = options.department || 'All';
    this.subject = options.subject || 'All';
    this.layout = options.layout || 'Courses';
    this.showRequirements = options.showRequirements;
    this.course = options.course || false;
    this.container = options.container;
    this.data = [];
    this.dataLoaded = false;
    this.courseCount = {};
    this.id = setTimeout(function(){}, 0);
    // Make up an ID if there isn't one
    if (!this.container.attr('id')) {
      this.container.attr('id', 'clearing-container-'+this.id);
    }
    this.container.addClass('c-clearing-container');

      // need to empty this only if we've NOT got a course panel layout.
      // this will prevent the default content being replaced
      if(this.layout !== 'Course panel' && this.layout !== 'Entry requirements' && this.layout !== 'Course search'  ) {
          this.container.empty();
      }

    if (this.layout === 'Courses') {
      this.courseCount = { 'UK/EU': 0 , 'International': 0 };
      this.letters = [];
      this.letterCount = 0;
      this.table = $('<table>').addClass('c-clearing-table');
      this.table.attr('id', 'clearing-table-'+this.id);
      // Update A to Z when search updates
      this.table.on('search.updated', { that: this }, this.updateAtoZ);
    } else if (this.layout === 'Departments') {
      this.list = $('<ul>').addClass('c-clearing-list');
      this.modalLink = false;
    } else if (this.layout === 'Course panel') {
      this.panel = $('<div>').addClass('c-panel c-panel--highlight').attr({'role':'alert'});
    }

    // Get our clearing data (triggers data.loaded on success)
    this.fetchData( 'https://spreadsheets.google.com/feeds/list/' + sheetId + '/1/public/values?alt=json' , backupDoc );

    var that = this;

    $window.on('data.loaded', function (e, id, data) {
      if (id === sheetId && that.dataLoaded === false) {

        // Only load it once, even if there's more than one table on a page!
        that.dataLoaded = true;

        // Filter out courses _not_ in clearing
        var tempData = [];

        $.grep(data, function(a) {
          if(
            a[ 'Home/EU' ].toLowerCase() === 'y' ||
            a.International.toLowerCase() === 'y' ||
            a[ 'Adjustment only home/EU' ].toLowerCase() === 'y' ||
            a[ 'Adjustment only international' ].toLowerCase() === 'y'
          ) {
            tempData.push(a);
          }
        });

        data = tempData;

        // Filter by other options

        if (that.department !== 'All') {
          // Filter by department
          $.grep(data, function(a) {
            if (a.Department === that.department) that.data.push(a);
          });
        } else if (that.subject !== 'All') {
          // Filter by subject
          $.grep(data, function(a) {
            var subjects = a.Subject.split( '|' );
            if( subjects.indexOf( that.subject ) !== -1 ) that.data.push(a);
          });
        } else if (that.course !== false) {
          // Filter by course
          $.grep(data, function(a) {
            if (a['UCAS code'] === that.course) that.data.push(a);
          });
        } else {
          that.data = data;
        }

        // Sort course title then Qualification
        that.data.sort(function (a, b) {
          if (that.layout === 'Courses') {
            if (a['Title of course'] === b['Title of course']) {
              return (a['Qualification earned'] > b['Qualification earned']) ? 1 : -1 ;
            }
            return (a['Title of course'] > b['Title of course']) ? 1 : -1 ;
          } else {
            return (a.Department > b.Department) ? 1 : -1 ;
          }
        });

        var currentLetter = false;
        var currentCourse = false;
        var inClearing = false;
        for (var i = 0; i < that.data.length; i++) {

          var thisCourse = that.data[i];

          // Course layout
          if (that.layout === 'Courses') {

            // Count UK/EU and Intl courses
            if ( thisCourse['Home/EU'].toLowerCase() === 'y' || thisCourse['Adjustment only home/EU'].toLowerCase() === 'y' ) that.courseCount['UK/EU']++;
            if ( thisCourse.International.toLowerCase() === 'y' || thisCourse['Adjustment only international'].toLowerCase() === 'y' ) that.courseCount.International++;

            // Add the row to the table?
            var addRow = false;

            if(
                ( that.type === 'Both' && ( thisCourse['Home/EU'].toLowerCase() === 'y' || thisCourse.International.toLowerCase() === 'y' || thisCourse['Adjustment only home/EU'].toLowerCase() === 'y' || thisCourse['Adjustment only international'].toLowerCase() === 'y' ) ) ||
                ( that.type === 'UK/EU' && ( thisCourse['Home/EU'].toLowerCase() === 'y' || thisCourse['Adjustment only home/EU'].toLowerCase() === 'y' ) ) ||
                ( that.type === 'International' && ( thisCourse.International.toLowerCase() === 'y' || thisCourse['Adjustment only international'].toLowerCase() === 'y' ) )
            ) addRow = true;

            if (addRow === true) {
              // Add letter headers and update letter count
              var thisLetter = thisCourse['Title of course'].substr(0,1);
              if (thisLetter !== currentLetter) {
                that.letters.push(thisLetter);
                that.letterCount++;
                that.addHeaderRow(thisLetter);
                currentLetter = thisLetter;
              }
              that.addCourseRow(thisCourse);

            }

          // Course panel layout
          } else if (that.layout === "Course panel" && that.inClearing(thisCourse)) {

              // empty the container
              that.container.empty();
              // set the 'inClearing' value so that the modal gets triggered later on
              inClearing = true;

            var panelContent = $('<div>').addClass('c-panel__content');
            that.modalLink = $('<a>').attr(
                {
                    'href': '#modal-content-'+that.id,
                    'class': 'c-btn c-btn--medium js-modal--scroll'
                }).text('See our clearing entry requirements');


            panelContent.append('<h3>Clearing and adjustment 2019</h3>');
            panelContent.append('<p>Places are available on this course through clearing and adjustment</p>');
            panelContent.append($('<p>').append(that.modalLink));

            var modalContent = $('<div>').addClass('is-hidden').attr({'id':'modal-content-'+that.id});

            // Course title
            modalContent.append('<h2>'+thisCourse['Qualification earned']+' '+thisCourse['Title of course']+'</h2>');

            // Availability text
            modalAvailabilityText = 'Clearing and adjustment places are available for <strong>';

            if (thisCourse['Home/EU'].toLowerCase() === 'y') modalAvailabilityText+= 'UK/EU students';
            if (thisCourse['Home/EU'].toLowerCase() === 'y' && thisCourse.International.toLowerCase() === 'y') modalAvailabilityText+= ' and ';
            if (thisCourse.International.toLowerCase() === 'y') modalAvailabilityText+= 'international students';

            modalAvailabilityText = '</strong>';

            modalContent.append('<p>'+modalAvailabilityText+'</p>');

            if(that.showRequirements) {
                modalContent.append('<h3>Entry requirements</h3>');
                if (thisCourse['No grades'] !== '' || thisCourse['Entry requirements'] !== '') {
                    var entryReqText = '';
                    if (thisCourse['No grades'] !== '') {

                        entryReqText += thisCourse['No grades'];

                    } else if (thisCourse['Entry requirements'] !== '') {

                        entryReqText += '<strong>' + thisCourse['Entry requirements'] + '</strong> or equivalent tariff points from three A levels. Other qualifications are also accepted.';
                    }
                    modalContent.append('<p>' + entryReqText + '</p>');
                }

                if (thisCourse['Bullet 1'] || thisCourse['Bullet 2'] || thisCourse['Bullet 3']) {
                    var modalBullets = $('<ul>');
                    if (thisCourse['Bullet 1']) {
                        modalBullets.append('<li>' + thisCourse['Bullet 1'] + '</li>');
                    }
                    if (thisCourse['Bullet 2']) {
                        modalBullets.append('<li>' + thisCourse['Bullet 2'] + '</li>');
                    }
                    if (thisCourse['Bullet 3']) {
                        modalBullets.append('<li>' + thisCourse['Bullet 3'] + '</li>');
                    }
                    modalContent.append('<p>Must include:</p>');
                    modalContent.append(modalBullets);
                }
            }

            var modalBullets1 = $('<ul>');
            var modalBullets2 = $('<ol>');

            modalContent.append('<h3>Call our hotline</h3>');
            modalContent.append('<p>To apply call ' + clearingData.phoneNumber + '</p>');
            modalContent.append('<p>Opening hours:</p>');

            modalBullets1.append('<li>16 - 17 August - 8am - 6pm</li>');
            modalBullets1.append('<li>18 - 19 August - 10am - 2pm</li>');
            modalBullets1.append('<li>20 - 24 August - Monday to Friday, 9am - 5pm</li>');
            modalContent.append(modalBullets1);

            modalContent.append('<p>Places fill up fast, so don\'t delay - give us a call and tell us why you want to apply.</p>');
            modalContent.append('<p>Before you call us</p>');

            modalBullets2.append('<li>Research the course(s) you\'re interested in and be ready to tell us why you want to apply.</li>');
            modalBullets2.append('<li>Pick up your results and make sure you meet the entry requirements. We\'ll need the details of your results in order to make our decision.</li>');
            modalBullets2.append('<li>Have your UCAS ID number to hand and a number we can call you back on.</li>');
            modalBullets2.append('<li>If your first language is not English you must also provide evidence of your <a href="https://www.york.ac.uk/study/undergraduate/applying/entry/english-language/">English language ability.</a></li>');
            modalContent.append(modalBullets2);

            that.panel.append(panelContent);
            that.panel.append(modalContent);

          // Department layout
          } else if (that.layout === "Departments") {

            // Set up department counts
            if (typeof that.courseCount[thisCourse.Department] === 'undefined') {
              that.courseCount[thisCourse.Department] = {
                'UK/EU': 0,
                'International': 0,
                'Adjustment UK/EU': 0,
                'Adjustment International': 0
              };
            }
            // Count UK/EU and Intl courses
            if (thisCourse['Home/EU'].toLowerCase() === 'y') that.courseCount[thisCourse.Department]['UK/EU']++;
            if (thisCourse.International.toLowerCase() === 'y') that.courseCount[thisCourse.Department].International++;
            if (thisCourse['Adjustment only home/EU'].toLowerCase() === 'y') that.courseCount[thisCourse.Department]['Adjustment UK/EU']++;
            if (thisCourse['Adjustment only international'].toLowerCase() === 'y') that.courseCount[thisCourse.Department]['Adjustment International']++;

            if (thisCourse.Department !== currentCourse.Department) {

              // Make link with previous course
              if (currentCourse !== false && (that.courseCount[currentCourse.Department]['UK/EU'] > 0 || that.courseCount[currentCourse.Department].International > 0 || that.courseCount[currentCourse.Department]['Adjustment UK/EU'] > 0 || that.courseCount[currentCourse.Department]['Adjustment International'] > 0 )) {
                var li = makeLink(currentCourse, that.courseCount[currentCourse.Department]);
                that.list.append(li);
              }
              currentCourse = thisCourse;
            }
            if (i === that.data.length - 1) {
              if (currentCourse.Department !== false && (that.courseCount[currentCourse.Department]['UK/EU'] > 0 || that.courseCount[currentCourse.Department].International > 0 || that.courseCount[currentCourse.Department]['Adjustment UK/EU'] > 0 || that.courseCount[currentCourse.Department]['Adjustment International'] > 0)) {
                var lastLi = makeLink(thisCourse, that.courseCount[thisCourse.Department]);
                that.list.append(lastLi);
              }
            }
          }

        }

        // Course layout
        if (that.layout === 'Courses') {
          // Add table to container
          that.container.append(that.table);

          if ((that.courseCount['UK/EU'] > searchLimit) || (that.courseCount.International > searchLimit)) {
            // Make table searchable
            that.makeSearchable();
          }

          // Grid layout for toggle/A to Z
          var g = $('<div>').addClass('o-grid');
          var gr = $('<div>').addClass('o-grid__row').appendTo(g);
          that.container.prepend(g);

          if ((that.courseCount['UK/EU'] === 0) && (that.courseCount.International === 0)) {

            var noCourseBox = $('<div>').addClass('o-grid__box o-grid__box--full');
            var noCourseBoxContent = that.createPanel(clearingData.noCourseMessage);
            noCourseBox.append(noCourseBoxContent);
            gr.append(noCourseBox);

          } else {

            // Add toggle switch if type is 'Both' (and there are some courses to toggle!)
            if (that.type === 'Both') {
              var gb1 = $('<div>').addClass('o-grid__box o-grid__box--half');
              var boxContent = '';
              if (that.courseCount['UK/EU'] !== 0 && that.courseCount.International !== 0) {
                boxContent = that.createToggle();
            } else if (that.courseCount.International > 0) {
                boxContent = that.createPanel('<p>The following courses only have places available for International students.</p>');
              } else if (that.courseCount['UK/EU'] > 0) {
                boxContent = that.createPanel('<p>The following courses only have places available for UK/EU students.</p>');
              }
              gb1.append(boxContent);
              gr.append(gb1);
            }

            // Add A to Z or remove header rows
            if (that.letterCount < letterLimit) {
              // Remove letter headers
              that.table.find('.c-clearing-table__letter-header').remove();
            } else {
              // Add A-Z links
              var ul = that.createLetterLinks();
              var gb2 = $('<div>').addClass('o-grid__box o-grid__box--half');
              gb2.append(ul);
              gr.append(gb2);
            }

          }

          // Click UK/EU toggle
          var ukeuToggle = $('#clearing-table-'+that.id+'-toggle-input-ukeu');
          ukeuToggle.click();

          //console.log(that.container, that.container.outerHeight());
          $(window).trigger('content.updated', ['clearing-table', that]);

        // Course panel layout
        } else if (that.layout === "Course panel" && inClearing) {

          that.container.append(that.panel);
          // console.log(that.container, that.container.outerHeight());
          $(window).trigger('content.updated', ['clearing-table', that]);

          new MODALLINK({
            link: that.modalLink
          });

        // Department layout
        } else if (that.layout === "Departments") {

          // Add list to container
          that.container.append($('<h3>').text('Vacancies by subject area'));
          that.container.append(that.list);

          //console.log(that.container, that.container.outerHeight());
          $(window).trigger('content.updated', ['clearing-table', that]);

        // Course search results
    } else if (that.layout === "Course search" && courseSearchClearingFeatures ) {

          var clearingYear = "2019";

          // --------------------------------------------------
          // First add filtering option

          var showAllCoursesButton = $( '#showAllCourses' );
          var filterToggle = $( '<label style="display:inline-block; padding:0.45rem 0; white-space:nowrap;"><input type="checkbox"> Show courses in clearing only</label>' );

          // Insert our toggle after the button
          showAllCoursesButton.after( filterToggle );

          filterToggle.on( 'change' , 'input' , function( e ) {

            var checkbox = this;
            that.container.removeClass( 'u-flashin' );

            // Delay update by 2xRAF to ensure that the keyframe animation kicks in
            requestAnimationFrame( function(){ requestAnimationFrame( function(){
              that.container.find( 'tbody tr:not(.in-clearing)' ).toggle( !checkbox.checked );
              that.container.addClass( 'u-flashin' );
            } ); } );

          } );

          // --------------------------------------------------
          // Add a clearing message to each row

          // Process each course row
          that.container.find( "tr[data-courseid]" ).each( function() {

            var courseRow = this;

            // Get the course UCAS code
            var ucasCode = $( this ).find( "td.code" ).html().trim();

            // Skip if no UCAS code found
            if( !ucasCode ) return;

            // Get our course from the clearing data
            var courseInClearing = false;
            $.grep( that.data , function( course ) {
              if( course[ "UCAS code" ] == ucasCode ) {
                courseInClearing = course;
              }
            });

            // Set up vars for the end result
            var clearingStatus = '';
            var clearingStatusIcon = '';

            // Check the clearing status of this course
            if( courseInClearing ) {

              // Add a class for filtering purposes
              $( courseRow ).addClass( 'in-clearing' );

              // Build our course link
              var courseLink = $( courseRow ).find( "td.coursetitle > a" );
              var courseTitle = courseLink.text();
              var courseURL = courseLink.attr( 'href' );
              var clearingCourseURL = courseURL.replace( '/courses/' , '/courses-'+clearingYear+'/' );

              var clearingStatusText = ( makeAvailabilityNote( courseInClearing ) || "Places available" );

              // Build our clearing message
              clearingStatus = '<a href="'+clearingCourseURL+'" aria-label="'+clearingStatusText+' for '+courseTitle+'">'+clearingStatusText+'</a>';
              clearingStatusIcon = '<i style="color:limegreen;" class="c-icon c-icon--check"></i>';

            } else {

              // Build a "No places available" message
              clearingStatus = 'No places available';
              clearingStatusIcon = '<i style="color:darkgray;" class="c-icon c-icon--remove"></i>';

            }

            // Inject our clearing message into the bottom of the cell
            // var contentCell = $( courseRow ).find( "td.coursetitle" );
            // contentCell.append( '<br><small>'+clearingStatusIcon+' <strong>Clearing and adjustment '+clearingYear+':</strong> '+clearingStatus+'</small>' );

            // Inject our clearing message after the course title
            var courseTitleLink = $( courseRow ).find( "td.coursetitle > a" );
            courseTitleLink.after( '<br><small>'+clearingStatusIcon+' <strong>Clearing and adjustment '+clearingYear+':</strong> '+clearingStatus+'</small>' );

          });

        // Entry requirements
        } else if (that.layout === "Entry requirements" && that.course !== false && that.inClearing( that.data[0] ) ) {

          var rows = [];

          // Sort out extra bullet points

          var bullets = [];

          for( var k = 1 ; k <= 3 ; k++ ) {
              if( that.data[0][ "Bullet "+k ] != '' ) {
                  bullets.push( that.data[0][ "Bullet "+k ] );
              }
          }

          var bulletsRendered = '';

          if( bullets.length == 1 ) {
              bulletsRendered = '<p>'+bullets[ 0 ]+'</p>';
          } else {
              bulletsRendered += '<ul>';
              for( var b = 0 ; b < bullets.length ; b++ ) {
                  bulletsRendered += '<li>'+bullets[ b ]+'</li>';
              }
              bulletsRendered += '</ul>';
          }

          if( that.data[0][ "Entry requirements" ] ) {

            // Main A level results required
            var alevelsRendered = '<p><strong>'+that.data[0][ "Entry requirements" ]+'</strong></p>';

            // Add to our extra rows
            rows.push( {
              'qualification': 'A levels',
              'offer': alevelsRendered+bulletsRendered
            } );

        } else {

            var altRendered = '<p><strong>'+that.data[0][ "Alternative requirement" ]+'</strong></p>';

            rows.push( {
              'qualification': that.data[0][ "Alternative qualification" ],
              'offer': altRendered+bulletsRendered
            } );

        }

          // Anything in no grades?
          if( that.data[0][ "No grades" ] ) {
              rows.push( {
                'qualification': 'n/a',
                'offer': that.data[0][ "No grades" ]
              } );
          }

          // Construct our output

          var requirements = '';

          requirements += '<thead>';
          requirements +=   '<tr>';
          requirements +=     '<th>Qualification</th>';
          requirements +=     '<th>Typical offer<sup>*</sup></span></th>';
          requirements +=   '</tr>';
          requirements += '</thead>';
          requirements += '<tbody>';

          for( var r = 0 ; r < rows.length ; r++ ){
            requirements +=   '<tr>';
            requirements +=     '<th>'+rows[ r ].qualification+'</th>';
            requirements +=     '<td>'+rows[ r ].offer+'</td>';
            requirements +=   '</tr>';
          }

          requirements += '</tbody>';

          // Swap out the default content for the clearing version

          that.container.empty();
          that.container.append( requirements );
          that.container.after( "<p><small><sup>*</sup> This offer has been adjusted for clearing. See our <a href=\"https://www.york.ac.uk/study/undergraduate/applying/entry/\">entry requirements page</a> for information on other qualifications that we accept.</small></p>" );

        }

      }

    });

    // console.info(this);

  };

  CLEARINGTABLE.prototype.updateAtoZ = function(e) {
    var that = e.data.that;
    var atozRows = that.table.find('.c-clearing-table__letter-header');
    atozRows.each(function(i, row) {
      var $row = $(row);
      var hideHeader = true;
      var courseRows = $row.nextUntil('.c-clearing-table__letter-header');
      var headerId = $row.children('th').attr('id');
      var atozLink = $('.c-atoz__nav-link[href="#'+headerId+'"]');
      $row.show();
      atozLink.removeClass('c-atoz__nav-link--inactive');
      courseRows.each(function(j, courseRow) {
        if (hideHeader === false) return;
        var $courseRow = $(courseRow);
        if (!$courseRow.hasClass('is-off') && !$courseRow.hasClass('is-hidden')) {
          hideHeader = false;
        }
        if (j === courseRows.length - 1 && hideHeader === true) {
          $row.hide();
          atozLink.addClass('c-atoz__nav-link--inactive');
        }
      });
    });
  };

  CLEARINGTABLE.prototype.inClearing = function(courseToCheck) {
    return (
      courseToCheck[ 'Home/EU' ].toLowerCase() === 'y' ||
      courseToCheck.International.toLowerCase() === 'y' ||
      courseToCheck[ 'Adjustment only home/EU' ].toLowerCase() === 'y' ||
      courseToCheck[ 'Adjustment only international' ].toLowerCase() === 'y'
    );
  };

  CLEARINGTABLE.prototype.createToggle = function() {
    var f = $('<form>').attr({
      'action': '#'+this.table.attr('id'),
      'method': 'get'
    }).addClass('c-form c-form--panel').on('submit', function(e) {
      e.preventDefault();
    });
    var fs = $('<fieldset>');
    var fe = $('<div>').addClass('c-form__element');
    var inputName = 'clearing-table-'+this.id+'-toggle-input';
    var fl = $('<label>').addClass('c-form__label')
                         .attr('for', inputName)
                         .text(this.label);
    var fg_ukeu = $('<div>').addClass('c-form__radio-group');
    var fi_ukeu = $('<input>').addClass('c-form__radio')
                              .attr({'type': 'radio', 'id': inputName+'-ukeu', 'name': inputName })
                              .val('ukeu')
                              .on('change', { that: this }, this.checkTable);
    var fl_ukeu = $('<label>').addClass('c-form__label')
                              .attr({'for': inputName+'-ukeu'})
                              .text('Courses for UK/EU students');
    var fg_intl = $('<div>').addClass('c-form__radio-group');
    var fi_intl = $('<input>').addClass('c-form__radio')
                              .attr({'type': 'radio', 'id': inputName+'-intl', 'name': inputName })
                              .val('international')
                              .on('change', { that: this }, this.checkTable);
    var fl_intl = $('<label>').addClass('c-form__label')
                              .attr({'for': inputName+'-intl'})
                              .text('Courses for International students');

    // Join it all together
    fg_ukeu.append(fi_ukeu, '&nbsp;', fl_ukeu);
    fg_intl.append(fi_intl, '&nbsp;', fl_intl);
    fe.append(fl, fg_ukeu, fg_intl);
    fs.append(fe);
    f.append(fs);

    return f;
  };

  CLEARINGTABLE.prototype.createPanel = function(panelContent) {
    var p = $('<div>').addClass('c-alert c-alert--info');
    var pc = $('<div>').addClass('c-alert__content').appendTo(p);
    pc.html(panelContent);
    return p;
  };

  CLEARINGTABLE.prototype.checkTable = function(e) {
    var $this = $(this);
    var that = e.data.that;
    var type = $this.val();
    // Get right table to update
    var formTarget = $this.parents('form').attr('action');
    var thisTable = $(formTarget);
    // Get all course rows
    var courseRows = thisTable.find('.c-clearing-table__course');
    courseRows.each(function(i, row) {
      var $row = $(row);
      $row.toggleClass('is-off', !$row.data(type));
    });
    var ev = jQuery.Event('keyup', { data: { that: that } });

    thisTable.removeClass( 'u-flashin' );

    // Delay update by 2xRAF to ensure that the keyframe animation kicks in
    requestAnimationFrame( function(){ requestAnimationFrame( function(){
      that.updateAtoZ(ev);
      thisTable.addClass( 'u-flashin' );
    } ); } );
  };

  CLEARINGTABLE.prototype.createLetterLinks = function() {
    var listId = 'clearing-table-'+this.id+'-atoz';
    var ul = $('<ul>').addClass('c-atoz__nav-list').attr('id', listId);
    var tableId = this.table.attr('id');

    // Make sure we cover all of the alphabet
    var alphabet = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

    $.each(alphabet, function(i, letter) {
      // Check target exists first
      var letterId = '#'+tableId+'-'+letter.toUpperCase();
      var headerRow = $(letterId);
      if (headerRow.length > 0) {
        var li = $('<li>').addClass('c-atoz__nav-item');
        var a = $('<a>').addClass('c-atoz__nav-link').attr('href', letterId).text(letter);
        li.append(a);
        ul.append(li);
        // Add 'Back to top' link to headers
        var topLink = $('<a>').addClass('c-clearing-table__top-link')
                              .attr('href', '#'+listId)
                              .text('Back to top');
        headerRow.append(topLink);
      } else {
        var li_inactive = $('<li>').addClass('c-atoz__nav-item');
        var a_inactive = $('<a>').addClass('c-atoz__nav-link').addClass('c-atoz__nav-link--inactive').text(letter);
        li_inactive.append(a_inactive);
        ul.append(li_inactive);
      }
    });
    return ul;
  };

  CLEARINGTABLE.prototype.makeSearchable = function() {
    this.container.addClass('js-searchable');
    this.searchable = new SEARCHABLE({
      container: this.table,
      header: '.c-clearing-table__letter-header',
      caseSensitive: false,
      label: 'Enter course title, keywords or UCAS code',
      analyticsAction: 'Course refinement'
    });
  };

  CLEARINGTABLE.prototype.addCourseRow = function(course) {

    var courseCell =$('<td>');
    var courseCellContent = '<p class="c-clearing-table__title"><a href="'+course['Link to course page']+'">'+course['Qualification earned']+' '+course['Title of course']+'</a></p>'+
      '<ul class="u-two-columns">';

    if(this.showRequirements) {
      if (course['No grades'] !== '') {

          courseCellContent += '<li class="c-clearing-table__entry-requirements">' + course['No grades'] + '</li>';

      } else if (course['Entry requirements'] !== '') {

          courseCellContent += '<li class="c-clearing-table__entry-requirements"><strong>' + course['Entry requirements'] + '</strong> or equivalent tariff points from three A levels. Other qualifications are also accepted.';

          if (course['Bullet 1'] || course['Bullet 2'] || course['Bullet 3']) {
              courseCellContent += '    <br>';
              courseCellContent += '    <small class="c-clearing-table__bullets">Must include: ';
          }
          if (course['Bullet 1']) courseCellContent += course['Bullet 1'];
          if (course['Bullet 2']) courseCellContent += '; ' + course['Bullet 2'];
          if (course['Bullet 3']) courseCellContent += '; ' + course['Bullet 3'] + '';
          if (course['Bullet 1'] || course['Bullet 2'] || course['Bullet 3']) courseCellContent += '</small>';

          courseCellContent += '</li>';
      } else if ( course['Alternative qualification'] !== '' && course['Alternative requirement'] !== '' ) {

          courseCellContent += '<li class="c-clearing-table__entry-requirements"><strong>' + course['Alternative qualification'] + '</strong> ' + course['Alternative requirement'];

          if (course['Bullet 1'] || course['Bullet 2'] || course['Bullet 3']) {
              courseCellContent += '    <br>';
              courseCellContent += '    <small class="c-clearing-table__bullets">';
          }
          if (course['Bullet 1']) courseCellContent += course['Bullet 1'];
          if (course['Bullet 2']) courseCellContent += '; ' + course['Bullet 2'];
          if (course['Bullet 3']) courseCellContent += '; ' + course['Bullet 3'] + '';
          if (course['Bullet 1'] || course['Bullet 2'] || course['Bullet 3']) courseCellContent += '</small>';

          courseCellContent += '</li>';

      }
    }

    courseCellContent+= '<li class="c-clearing-table__ucas-code">UCAS code '+course['UCAS code']+'</li>'+
    '<li class="c-clearing-table__course-length">'+course['Course length']+'</li>'+
    '<li class="c-clearing-table__phone-numbers">Call Admissions on ' + clearingData.phoneNumber + '</li>';

    // Availability note
    var availabilityNote = makeAvailabilityNote( course );
    if( availabilityNote ) courseCellContent+= '<li class="c-clearing-table__adjustment-only">'+availabilityNote+'</li>';

    courseCellContent+= '</ul>';
    courseCell.html(courseCellContent);
    var courseRow = $('<tr>').addClass('c-clearing-table__course');
    courseRow.append(courseCell);
    if (this.type === 'UK/EU' || this.type === 'Both') {
      courseRow.attr('data-ukeu', ( course['Home/EU'].toLowerCase() === 'y' || course['Adjustment only home/EU'].toLowerCase() === 'y' ) ? 'true' : 'false');
    }
    if (this.type === 'International' || this.type === 'Both') {
      courseRow.attr('data-international', ( course.International.toLowerCase() === 'y' || course['Adjustment only international'].toLowerCase() === 'y' ) ? 'true' : 'false');
    }
    this.table.append(courseRow);
  };

  CLEARINGTABLE.prototype.addHeaderRow = function(letter) {
    var rowId = this.table.attr('id')+'-'+letter.toUpperCase();
    var headerCell = $('<th>').text(letter.toUpperCase()).attr('id', rowId);
    var headerRow = $('<tr>').addClass('c-clearing-table__letter-header').append(headerCell);
    this.table.append(headerRow);
  };

  CLEARINGTABLE.prototype.fetchData = function(endpoint,fallback) {

    var that = this;

    $.ajax({
      dataType: "json",
      url: endpoint,
      error: function( jqXHR, textStatus, errorThrown ) { // Error!

        // Try our fallback URL
        if( fallback != undefined ) {
          console.warn( '⚠ Clearing data fetch failed, trying fallback...' );
          that.fetchData( fallback );
        } else {
          console.error( '⚠ Clearing data fetch failed' );
        }

      },
      success: function( rawData ) { // Success!

        // Field mappings from gsheet API source to our clearing course object
        // source : destination
        var fieldMap = {
          gsx$adjustmentonlyhomeeu: "Adjustment only home/EU",
          gsx$adjustmentonlyinternational: "Adjustment only international",
          gsx$adjustmentonlyhiy: "Adjustment only",
          gsx$bullet1: "Bullet 1",
          gsx$bullet2: "Bullet 2",
          gsx$bullet3: "Bullet 3",
          gsx$courselength: "Course length",
          gsx$department: "Department",
          gsx$entryrequirements: "Entry requirements",
          gsx$inclearinghomeeu: "Home/EU",
          gsx$inclearinginternational: "International",
          gsx$linktocoursepage: "Link to course page",
          gsx$mcrcode: "MCR_CODE",
          gsx$nogrades: "No grades",
          gsx$qualificationearned: "Qualification earned",
          gsx$sracheckx: "SRA check?\n✓ X",
          gsx$subject: "Subject",
          gsx$titleofcourse: "Title of course",
          gsx$ucascode: "UCAS code",
          gsx$alternativequalification: "Alternative qualification",
          gsx$alternativerequirement: "Alternative requirement",
        };

        var data = []; // The data object we'll be returning

        var rows = rawData.feed.entry; // Get all data rows

        var sourceKeys = Object.keys( fieldMap ); // Get fieldmap keys for later

        // Process each row in the incoming data
        for( var r = 0 ; r < rows.length ; r++ ) {

          row = rows[ r ];
          dataRow = {};

          // Check each entry in our fieldmap
          for( var k = 0 ; k < sourceKeys.length ; k++ ) {
            var sourceKey = sourceKeys[ k ];
            var destinationKey = fieldMap[ sourceKey ];

            // Get the value for this field
            if( row[ sourceKey ] !== undefined && row[ sourceKey ].$t !== undefined ) {
              dataRow[ destinationKey ] = row[ sourceKey ].$t;
            }
          }

          // Add row data to our return object
          data.push( dataRow );
        }

        $(window).trigger('data.loaded', [sheetId, data]);

      }
    });

    $.getJSON( endpoint );
  };

  return CLEARINGTABLE;

});
